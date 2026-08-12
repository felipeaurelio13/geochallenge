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
    masteryAttempt: { createMany },
  };

  return { prismaStub, $transaction, create, createMany, findMany, findUnique, update, questionFindMany };
});

vi.mock('../config/database.js', () => ({ prisma: mocks.prismaStub }));

import { applyMasteryAttemptsForRun, calculateMasteryScore, getMasteryLevel } from '../services/mastery.service.js';
import { saveGameResult } from '../services/game.service.js';
import type { AnswerResult } from '../services/game.service.js';

function makeAnswerResult(qid: string, isCorrect: boolean, points: number = 100): AnswerResult {
  return { questionId: qid, isCorrect, correctAnswer: 'A', userAnswer: 'A', points, timeRemaining: 5 };
}

describe('applyMasteryAttemptsForRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createMany.mockResolvedValue({ count: 1 });
  });

  it('creates attempt for question with countryCode', async () => {
    mocks.questionFindMany.mockResolvedValue([
      { id: 'q1', countryCode: 'CL', category: 'FLAG', difficulty: 'MEDIUM' },
    ]);

    await applyMasteryAttemptsForRun(
      mocks.prismaStub as any,
      'u1',
      'run1',
      GameMode.SINGLE,
      GameVariant.CLASSIC,
      [{ questionId: 'q1', isCorrect: true }]
    );

    expect(mocks.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            userId: 'u1',
            runId: 'run1',
            questionId: 'q1',
            countryCode: 'CL',
            category: 'FLAG',
            isCorrect: true,
          }),
        ]),
        skipDuplicates: true,
      })
    );
  });

  it('does NOT create attempt for question without countryCode', async () => {
    mocks.questionFindMany.mockResolvedValue([
      { id: 'q1', countryCode: null, category: 'FLAG', difficulty: null },
    ]);

    await applyMasteryAttemptsForRun(
      mocks.prismaStub as any,
      'u1', 'run1', GameMode.SINGLE, GameVariant.CLASSIC,
      [{ questionId: 'q1', isCorrect: true }]
    );

    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it('does NOT create attempt for MIXED category', async () => {
    mocks.questionFindMany.mockResolvedValue([
      { id: 'q1', countryCode: 'CL', category: 'MIXED', difficulty: null },
    ]);

    await applyMasteryAttemptsForRun(
      mocks.prismaStub as any,
      'u1', 'run1', GameMode.SINGLE, GameVariant.CLASSIC,
      [{ questionId: 'q1', isCorrect: true }]
    );

    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it('uses skipDuplicates to prevent double-counting same run+question', async () => {
    mocks.questionFindMany.mockResolvedValue([
      { id: 'q1', countryCode: 'CL', category: 'FLAG', difficulty: 'MEDIUM' },
    ]);

    await applyMasteryAttemptsForRun(
      mocks.prismaStub as any,
      'u1', 'run1', GameMode.SINGLE, GameVariant.CLASSIC,
      [{ questionId: 'q1', isCorrect: true }]
    );

    expect(mocks.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
  });

  it('records difficulty when present', async () => {
    mocks.questionFindMany.mockResolvedValue([
      { id: 'q1', countryCode: 'CL', category: 'FLAG', difficulty: 'HARD' },
    ]);

    await applyMasteryAttemptsForRun(
      mocks.prismaStub as any,
      'u1', 'run1', GameMode.SINGLE, GameVariant.CLASSIC,
      [{ questionId: 'q1', isCorrect: true }]
    );

    expect(mocks.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ difficulty: 'HARD' }),
        ]),
        skipDuplicates: true,
      })
    );
  });

  it('handles empty answers gracefully', async () => {
    await applyMasteryAttemptsForRun(
      mocks.prismaStub as any,
      'u1', 'run1', GameMode.SINGLE, GameVariant.CLASSIC,
      []
    );

    expect(mocks.questionFindMany).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
  });
});

describe('saveGameResult — mastery integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: 'gr1' });
    mocks.findUnique.mockResolvedValue({ highScore: 500, gamesPlayed: 10 });
    mocks.update.mockResolvedValue({});
    mocks.createMany.mockResolvedValue({ count: 1 });
    mocks.questionFindMany.mockResolvedValue([
      { id: 'q1', countryCode: 'CL', category: 'FLAG', difficulty: 'MEDIUM' },
    ]);
  });

  it('creates GameResult + mastery inside same transaction', async () => {
    const answers = [makeAnswerResult('q1', true, 100)];
    await saveGameResult('u1', answers, GameVariant.CLASSIC, GameMode.SINGLE, undefined, undefined, 'run1');

    expect(mocks.create).toHaveBeenCalled();
    expect(mocks.createMany).toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalled();
  });

  it('runId fallback uses gameResult.id when runId not provided', async () => {
    const answers = [makeAnswerResult('q1', true, 100)];
    await saveGameResult('u1', answers, GameVariant.CLASSIC, GameMode.SINGLE);

    expect(mocks.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ runId: 'gr1' })]) })
    );
  });

  it('does NOT update highScore for PRACTICE', async () => {
    mocks.findUnique.mockResolvedValue({ highScore: 500, gamesPlayed: 10 });
    const answers = [makeAnswerResult('q1', true, 800)];
    const result = await saveGameResult('u1', answers, GameVariant.PRACTICE, GameMode.SINGLE);
    expect(result.isHighScore).toBe(false);

    const updateCall = mocks.update.mock.calls[0]?.[0] as { data?: Record<string, unknown> } | undefined;
    expect((updateCall?.data ?? {}).highScore).toBeUndefined();
  });

  it('retry finish returns existing without duplicating mastery', async () => {
    mocks.create.mockRejectedValueOnce({ code: 'P2002' });
    mocks.findUnique.mockResolvedValueOnce({ id: 'existing-gr1', score: 100 });

    await saveGameResult('u1', [makeAnswerResult('q1', true, 100)], GameVariant.CLASSIC, GameMode.SINGLE, undefined, undefined, 'run_dup');

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.createMany).not.toHaveBeenCalled();
  });
});
