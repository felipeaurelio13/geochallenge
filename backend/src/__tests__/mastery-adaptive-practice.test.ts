import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Category, Difficulty, GameMode, GameVariant } from '@prisma/client';

const mocks = vi.hoisted(() => {
  const create = vi.fn();
  const createMany = vi.fn();
  const findMany = vi.fn();
  const findUnique = vi.fn();
  const update = vi.fn();
  const $transaction = vi.fn();
  const questionFindMany = vi.fn();
  const masteryAttemptFindMany = vi.fn();

  const prismaStub = {
    $transaction: $transaction.mockImplementation(
      (fn: (stub: typeof prismaStub) => Promise<unknown>) => fn(prismaStub)
    ),
    gameResult: { create, findMany, findUnique },
    user: { findUnique, update },
    question: { findMany: questionFindMany },
    masteryAttempt: { createMany, findMany: masteryAttemptFindMany },
  };

  return { prismaStub, $transaction, create, createMany, findMany, findUnique, update, questionFindMany, masteryAttemptFindMany };
});

vi.mock('../config/database.js', () => ({ prisma: mocks.prismaStub }));

import { selectAdaptivePracticeQuestions } from '../services/mastery.service.js';

function makeQuestions(codes: string[], categories: Category[] = [Category.FLAG]): any[] {
  return codes.map((cc, i) => ({
    id: `q_${cc}_${i}`,
    countryCode: cc,
    category: categories[i] ?? Category.FLAG,
    difficulty: Difficulty.MEDIUM,
    isAvailable: true,
  }));
}

describe('selectAdaptivePracticeQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns up to count questions', async () => {
    mocks.masteryAttemptFindMany.mockResolvedValue([]);
    mocks.questionFindMany.mockResolvedValue(
      makeQuestions(['CL', 'AR', 'BR', 'PE', 'MX', 'US', 'FR', 'DE', 'JP', 'CN', 'IT', 'ES'])
    );

    const result = await selectAdaptivePracticeQuestions('u1', 5);
    expect(result.length).toBeLessThanOrEqual(5);
    expect(result.length).toBeGreaterThan(0);
  });

  it('country-focused only selects questions from given country', async () => {
    mocks.masteryAttemptFindMany.mockResolvedValue([]);
    const allQuestions = [
      ...makeQuestions(['CL', 'CL', 'CL', 'CL', 'CL'], [Category.FLAG, Category.CAPITAL, Category.MAP, Category.SILHOUETTE, Category.MONUMENT]),
      ...makeQuestions(['AR', 'AR'], [Category.FLAG, Category.CAPITAL]),
    ];

    mocks.questionFindMany.mockImplementation((args: any) => {
      const where = args?.where;
      if (where?.countryCode === 'CL') {
        return Promise.resolve(allQuestions.filter((q) => q.countryCode === 'CL'));
      }
      return Promise.resolve(allQuestions.filter((q) => q.countryCode !== null));
    });

    const result = await selectAdaptivePracticeQuestions('u1', 3, 'CL');
    expect(result.length).toBeGreaterThan(0);
    for (const id of result) {
      expect(id).toContain('CL');
    }
  });

  it('does not repeat questionId within a session', async () => {
    const questions = makeQuestions(['CL', 'AR', 'BR'], [Category.FLAG, Category.FLAG, Category.FLAG]);
    mocks.masteryAttemptFindMany.mockResolvedValue([]);
    mocks.questionFindMany.mockResolvedValue(questions);

    const result = await selectAdaptivePracticeQuestions('u1', 3);

    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });

  it('respects diversity by country (max 2 per country)', async () => {
    const questions = [
      ...makeQuestions(['CL', 'CL', 'CL', 'CL', 'CL', 'CL'], [Category.FLAG, Category.CAPITAL, Category.MAP, Category.SILHOUETTE, Category.MONUMENT, Category.CINEMA_GEO]),
      ...makeQuestions(['AR', 'AR', 'AR', 'AR', 'AR', 'AR'], [Category.FLAG, Category.CAPITAL, Category.MAP, Category.SILHOUETTE, Category.MONUMENT, Category.CINEMA_GEO]),
      ...makeQuestions(['BR', 'BR'], [Category.FLAG, Category.CAPITAL]),
    ];
    mocks.masteryAttemptFindMany.mockResolvedValue([]);
    mocks.questionFindMany.mockResolvedValue(questions);

    const result = await selectAdaptivePracticeQuestions('u1', 5);

    const countryCounts = new Map<string, number>();
    for (const id of result) {
      const cc = id.split('_')[1];
      countryCounts.set(cc, (countryCounts.get(cc) ?? 0) + 1);
    }
    for (const [, count] of countryCounts) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('weak skills get higher priority than mastered', async () => {
    const clQuestions = makeQuestions(['CL', 'CL'], [Category.FLAG, Category.CAPITAL]);
    const arQuestions = makeQuestions(['AR', 'AR'], [Category.FLAG, Category.CAPITAL]);

    mocks.questionFindMany.mockResolvedValue([...clQuestions, ...arQuestions]);

    // CL: mastered (8/8 correct), AR: weak (1/8 correct)
    mocks.masteryAttemptFindMany.mockResolvedValue([
      ...Array(8).fill(null).map((_, i) => ({ countryCode: 'CL', category: 'FLAG', isCorrect: true, occurredAt: new Date(Date.now() - i * 3600000) })),
      ...Array(8).fill(null).map((_, i) => ({ countryCode: 'CL', category: 'CAPITAL', isCorrect: true, occurredAt: new Date(Date.now() - i * 3600000) })),
      { countryCode: 'AR', category: 'FLAG', isCorrect: false, occurredAt: new Date() },
      { countryCode: 'AR', category: 'FLAG', isCorrect: false, occurredAt: new Date() },
    ]);

    const result = await selectAdaptivePracticeQuestions('u1', 2);

    // AR questions should be selected before CL since CL is mastered
    const arFirst = result.every((id) => id.startsWith('q_AR'));
    expect(arFirst).toBe(true);
  });

  it('last incorrect attempt receives priority boost', async () => {
    const questions = [
      ...makeQuestions(['CL', 'CL'], [Category.FLAG, Category.CAPITAL]),
      ...makeQuestions(['AR', 'AR'], [Category.FLAG, Category.CAPITAL]),
      ...makeQuestions(['BR', 'BR'], [Category.FLAG, Category.CAPITAL]),
    ];
    mocks.questionFindMany.mockResolvedValue(questions);

    // CL: all correct, AR: all correct, BR: last was incorrect
    mocks.masteryAttemptFindMany.mockResolvedValue([
      { countryCode: 'CL', category: 'FLAG', isCorrect: true, occurredAt: new Date() },
      { countryCode: 'CL', category: 'CAPITAL', isCorrect: true, occurredAt: new Date() },
      { countryCode: 'AR', category: 'FLAG', isCorrect: true, occurredAt: new Date() },
      { countryCode: 'AR', category: 'CAPITAL', isCorrect: true, occurredAt: new Date() },
      { countryCode: 'BR', category: 'FLAG', isCorrect: false, occurredAt: new Date() },
    ]);

    const result = await selectAdaptivePracticeQuestions('u1', 2);

    // BR should appear first (last incorrect boost)
    expect(result[0]).toContain('BR');
  });

  it('question answered <24h ago receives penalty', async () => {
    const questions = [
      ...makeQuestions(['CL', 'CL', 'CL'], [Category.FLAG, Category.CAPITAL, Category.MAP]),
      ...makeQuestions(['AR', 'AR'], [Category.FLAG, Category.CAPITAL]),
    ];
    mocks.questionFindMany.mockResolvedValue(questions);

    // ALL categories for CL were answered recently, AR is untouched
    mocks.masteryAttemptFindMany.mockResolvedValue([
      { countryCode: 'CL', category: 'FLAG', isCorrect: true, occurredAt: new Date() },
      { countryCode: 'CL', category: 'CAPITAL', isCorrect: true, occurredAt: new Date() },
      { countryCode: 'CL', category: 'MAP', isCorrect: true, occurredAt: new Date() },
    ]);

    const result = await selectAdaptivePracticeQuestions('u1', 2);

    // AR should be preferred since CL was answered recently
    expect(result[0]).toContain('AR');
  });

  it('preserves diversity by category when pool is sufficient', async () => {
    const questions = [
      ...makeQuestions(['CL', 'CL', 'CL', 'CL', 'CL', 'CL'], [Category.FLAG, Category.CAPITAL, Category.MAP, Category.SILHOUETTE, Category.MONUMENT, Category.CINEMA_GEO]),
      ...makeQuestions(['AR', 'AR', 'AR', 'AR', 'AR', 'AR'], [Category.FLAG, Category.CAPITAL, Category.MAP, Category.SILHOUETTE, Category.MONUMENT, Category.CINEMA_GEO]),
    ];
    mocks.masteryAttemptFindMany.mockResolvedValue([]);
    mocks.questionFindMany.mockResolvedValue(questions);

    const result = await selectAdaptivePracticeQuestions('u1', 6);

    const catCounts = new Map<string, number>();
    for (const id of result) {
      const q = questions.find((q) => q.id === id);
      if (q) catCounts.set(q.category, (catCounts.get(q.category) ?? 0) + 1);
    }
    const maxCat = catCounts.size > 0 ? Math.max(...catCounts.values()) : 0;
    expect(maxCat).toBeLessThanOrEqual(4); // ceil(6/2) = 3, relaxed later
  });

  it('returns empty array when no questions available', async () => {
    mocks.masteryAttemptFindMany.mockResolvedValue([]);
    mocks.questionFindMany.mockResolvedValue([]);

    const result = await selectAdaptivePracticeQuestions('u1', 5);
    expect(result).toEqual([]);
  });
});
