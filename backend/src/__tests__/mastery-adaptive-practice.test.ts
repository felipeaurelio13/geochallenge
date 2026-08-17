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
      ...makeQuestions(['CL', 'CL', 'CL', 'CL', 'CL', 'CL'], [Category.FLAG, Category.CAPITAL, Category.MAP, Category.SILHOUETTE, Category.MONUMENT]),
      ...makeQuestions(['AR', 'AR', 'AR', 'AR', 'AR', 'AR'], [Category.FLAG, Category.CAPITAL, Category.MAP, Category.SILHOUETTE, Category.MONUMENT]),
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

    // CL questions were answered recently (per-question recency), AR is untouched
    mocks.masteryAttemptFindMany.mockResolvedValue([
      { questionId: 'q_CL_0', countryCode: 'CL', category: 'FLAG', isCorrect: true, occurredAt: new Date() },
      { questionId: 'q_CL_1', countryCode: 'CL', category: 'CAPITAL', isCorrect: true, occurredAt: new Date() },
      { questionId: 'q_CL_2', countryCode: 'CL', category: 'MAP', isCorrect: true, occurredAt: new Date() },
    ]);

    const result = await selectAdaptivePracticeQuestions('u1', 2);

    // AR should be preferred since CL questions were answered recently
    expect(result[0]).toContain('AR');
  });

  it('recency penalty is per-question, not per-skill', async () => {
    // Same country + same category: CL FLAG q1 answered 1h ago, q2 never answered
    const clFlagQ1 = { id: 'q_CL_0', countryCode: 'CL', category: Category.FLAG, difficulty: Difficulty.MEDIUM, isAvailable: true };
    const clFlagQ2 = { id: 'q_CL_1', countryCode: 'CL', category: Category.FLAG, difficulty: Difficulty.MEDIUM, isAvailable: true };
    const arFlagQ1 = { id: 'q_AR_0', countryCode: 'AR', category: Category.FLAG, difficulty: Difficulty.MEDIUM, isAvailable: true };
    const questions = [clFlagQ2, clFlagQ1, arFlagQ1];
    mocks.questionFindMany.mockResolvedValue(questions);
    mocks.masteryAttemptFindMany.mockResolvedValue([
      { questionId: 'q_CL_0', countryCode: 'CL', category: 'FLAG', isCorrect: true, occurredAt: new Date() },
    ]);

    const result = await selectAdaptivePracticeQuestions('u1', 2);

    // q_CL_0 was just answered → -40 recency penalty → lower priority
    // q_CL_1 was NOT answered → no recency penalty → higher priority
    // q_AR_0 → same base priority as q_CL_1 (both unseen) but jitter decides
    // Result: q_CL_1 should be selected before q_CL_0
    expect(result).toContain('q_CL_1');
    expect(result[0]).not.toBe('q_CL_0');
  });

  it('preserves diversity by category when pool is sufficient', async () => {
    const questions = [
      ...makeQuestions(['CL', 'CL', 'CL', 'CL', 'CL', 'CL'], [Category.FLAG, Category.CAPITAL, Category.MAP, Category.SILHOUETTE, Category.MONUMENT]),
      ...makeQuestions(['AR', 'AR', 'AR', 'AR', 'AR', 'AR'], [Category.FLAG, Category.CAPITAL, Category.MAP, Category.SILHOUETTE, Category.MONUMENT]),
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
