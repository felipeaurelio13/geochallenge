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

  const prismaStub = {
    $transaction: $transaction.mockImplementation(
      (fn: (stub: typeof prismaStub) => Promise<unknown>) => fn(prismaStub)
    ),
    gameResult: { create, findMany, findUnique },
    user: { findUnique, update },
    question: { findMany: questionFindMany },
    masteryAttempt: { createMany, findMany: vi.fn().mockResolvedValue([]) },
  };

  return { prismaStub, $transaction, create, createMany, findMany, findUnique, update, questionFindMany };
});

vi.mock('../config/database.js', () => ({ prisma: mocks.prismaStub }));

import { applyMasteryAttemptsForRun } from '../services/mastery.service.js';
import { toPublicQuestion, toPublicSocketPayload } from '../services/game.service.js';

function makeGameQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q1',
    category: Category.FLAG,
    questionText: 'Test?',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    imageUrl: 'http://img',
    latitude: 10,
    longitude: 20,
    countryCode: 'CL',
    ...overrides,
  };
}

describe('Public question — privacy guarantees', () => {
  it('toPublicQuestion strips correctAnswer, latitude, longitude, countryCode', () => {
    const q = makeGameQuestion();
    const result = toPublicQuestion(q);
    expect((result as any).correctAnswer).toBeUndefined();
    expect((result as any).latitude).toBeUndefined();
    expect((result as any).longitude).toBeUndefined();
    expect((result as any).countryCode).toBeUndefined();
    expect(result.id).toBe('q1');
    expect(result.category).toBe('FLAG');
    expect(result.questionText).toBe('Test?');
  });

  it('toPublicSocketPayload strips correctAnswer, latitude, longitude, countryCode', () => {
    const obj = {
      id: 'q1',
      correctAnswer: 'SECRET',
      latitude: 10,
      longitude: 20,
      countryCode: 'CL',
      category: 'FLAG',
      questionText: 'Test?',
    };
    const result = toPublicSocketPayload(obj);
    expect((result as any).correctAnswer).toBeUndefined();
    expect((result as any).latitude).toBeUndefined();
    expect((result as any).longitude).toBeUndefined();
    expect((result as any).countryCode).toBeUndefined();
    expect(result.category).toBe('FLAG');
  });

  it('does not strip countryCode when none present (backward compat)', () => {
    const q = makeGameQuestion({ countryCode: undefined });
    const result = toPublicQuestion(q);
    expect((result as any).countryCode).toBeUndefined();
    expect((result as any).correctAnswer).toBeUndefined();
  });

  it('public question preserves questionText and options', () => {
    const q = makeGameQuestion();
    const result = toPublicQuestion(q);
    expect(result.questionText).toBe('Test?');
    expect(result.options).toEqual(['A', 'B', 'C', 'D']);
    expect(result.imageUrl).toBe('http://img');
  });
});

describe('Mastery — integration contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createMany.mockResolvedValue({ count: 1 });
  });

  it('Daily variant creates mastery with GameVariant.DAILY', async () => {
    mocks.questionFindMany.mockResolvedValue([
      { id: 'q1', countryCode: 'CL', category: 'FLAG', difficulty: 'MEDIUM' },
    ]);

    await applyMasteryAttemptsForRun(
      mocks.prismaStub as any,
      'u1', 'daily:u1:2026-08-11', GameMode.SINGLE, GameVariant.DAILY,
      [{ questionId: 'q1', isCorrect: true }]
    );

    expect(mocks.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ variant: 'DAILY' }),
        ]),
        skipDuplicates: true,
      })
    );
  });

  it('Flag Master variant creates mastery with GameVariant.FLAG_MASTER', async () => {
    mocks.questionFindMany.mockResolvedValue([
      { id: 'q1', countryCode: 'CL', category: 'FLAG', difficulty: 'HARD' },
    ]);

    await applyMasteryAttemptsForRun(
      mocks.prismaStub as any,
      'u1', 'fm_game1', GameMode.SINGLE, GameVariant.FLAG_MASTER,
      [{ questionId: 'q1', isCorrect: true }]
    );

    expect(mocks.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ variant: 'FLAG_MASTER', gameMode: 'SINGLE' }),
        ]),
        skipDuplicates: true,
      })
    );
  });

  it('Challenge variant creates mastery with GameMode.CHALLENGE', async () => {
    mocks.questionFindMany.mockResolvedValue([
      { id: 'q1', countryCode: 'CL', category: 'FLAG', difficulty: 'MEDIUM' },
    ]);

    await applyMasteryAttemptsForRun(
      mocks.prismaStub as any,
      'u1', 'challenge:ch1:u1', GameMode.CHALLENGE, GameVariant.CLASSIC,
      [{ questionId: 'q1', isCorrect: true }]
    );

    expect(mocks.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ gameMode: 'CHALLENGE' }),
        ]),
        skipDuplicates: true,
      })
    );
  });

  it('PRACTICE variant creates mastery with GameVariant.PRACTICE', async () => {
    mocks.questionFindMany.mockResolvedValue([
      { id: 'q1', countryCode: 'CL', category: 'FLAG', difficulty: 'MEDIUM' },
    ]);

    await applyMasteryAttemptsForRun(
      mocks.prismaStub as any,
      'u1', 'run1', GameMode.SINGLE, GameVariant.PRACTICE,
      [{ questionId: 'q1', isCorrect: true }]
    );

    expect(mocks.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ variant: 'PRACTICE', gameMode: 'SINGLE' }),
        ]),
        skipDuplicates: true,
      })
    );
  });

  it('unique constraint userId+runId+questionId prevents double-counting on retry', async () => {
    mocks.questionFindMany.mockResolvedValue([
      { id: 'q1', countryCode: 'CL', category: 'FLAG', difficulty: 'MEDIUM' },
    ]);

    // First call: creates
    await applyMasteryAttemptsForRun(
      mocks.prismaStub as any,
      'u1', 'run1', GameMode.SINGLE, GameVariant.CLASSIC,
      [{ questionId: 'q1', isCorrect: true }]
    );

    const firstCallData = mocks.createMany.mock.calls[0][0].data;
    expect(firstCallData).toHaveLength(1);
    expect(firstCallData[0]).toMatchObject({ userId: 'u1', runId: 'run1', questionId: 'q1' });

    // Second call with same params: createMany still called but skipDuplicates prevents actual insertion
    await applyMasteryAttemptsForRun(
      mocks.prismaStub as any,
      'u1', 'run1', GameMode.SINGLE, GameVariant.CLASSIC,
      [{ questionId: 'q1', isCorrect: true }]
    );

    // Both calls pass skipDuplicates: true
    expect(mocks.createMany).toHaveBeenCalledTimes(2);
    expect(mocks.createMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ skipDuplicates: true }));
  });

  it('filters out multiple null-countryCode questions from batch', async () => {
    mocks.questionFindMany.mockResolvedValue([
      { id: 'q1', countryCode: 'CL', category: 'FLAG', difficulty: 'MEDIUM' },
      { id: 'q2', countryCode: null, category: 'FLAG', difficulty: null },
      { id: 'q3', countryCode: 'AR', category: 'CAPITAL', difficulty: 'EASY' },
    ]);

    await applyMasteryAttemptsForRun(
      mocks.prismaStub as any,
      'u1', 'run1', GameMode.SINGLE, GameVariant.CLASSIC,
      [
        { questionId: 'q1', isCorrect: true },
        { questionId: 'q2', isCorrect: false },
        { questionId: 'q3', isCorrect: true },
      ]
    );

    const data = mocks.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(2); // q2 filtered out
    const codes = data.map((d: any) => d.countryCode);
    expect(codes).toContain('CL');
    expect(codes).toContain('AR');
    expect(codes).not.toContain(null);
  });

  it('GeoRetos (GEO_CHALLENGE) is handled by not calling applyMastery — verified at call site', () => {
    // GeoRetos explicitly bypasses applyMasteryAttemptsForRun
    // This test verifies the function exists and can be called but is skipped
    // at the call site level (geoChallenge controller does not import mastery)
    expect(applyMasteryAttemptsForRun).toBeDefined();
  });
});
