import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameMode, GameVariant } from '@prisma/client';

const mocks = vi.hoisted(() => {
  const create = vi.fn();
  const findMany = vi.fn();
  const findUnique = vi.fn();
  const update = vi.fn();
  const $transaction = vi.fn();

  const prismaStub = {
    $transaction: $transaction.mockImplementation(
      (fn: (stub: typeof prismaStub) => Promise<unknown>) => fn(prismaStub)
    ),
    gameResult: { create, findMany },
    user: { findUnique, update },
  };

  return { prismaStub, $transaction, create, findMany, findUnique, update };
});

vi.mock('../config/database.js', () => ({ prisma: mocks.prismaStub }));

import { saveGameResult, getCategoryStats } from '../services/game.service.js';
import type { AnswerResult } from '../services/game.service.js';

function makeAnswerResult(overrides: Partial<AnswerResult> = {}): AnswerResult {
  return {
    questionId: 'q1',
    isCorrect: true,
    correctAnswer: 'A',
    userAnswer: 'A',
    points: 100,
    timeRemaining: 5,
    ...overrides,
  };
}

describe('saveGameResult — variant + highScore isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: 'gr1' });
    mocks.findUnique.mockResolvedValue({ highScore: 500, gamesPlayed: 10 });
    mocks.update.mockResolvedValue({});
  });

  it('Classic (SINGLE + CLASSIC) puede actualizar highScore si supera el anterior', async () => {
    const answers = [makeAnswerResult({ points: 150 }), makeAnswerResult({ points: 150 })];
    const result = await saveGameResult('u1', answers, undefined, GameMode.SINGLE, undefined, GameVariant.CLASSIC);

    expect(result.isHighScore).toBe(false);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ variant: GameVariant.CLASSIC }) })
    );

    const updateCall = mocks.update.mock.calls[0]?.[0] as { data?: Record<string, unknown> } | undefined;
    const data = updateCall?.data ?? {};
    expect(data.highScore).toBeUndefined();
  });

  it('Classic (SINGLE + CLASSIC) sí actualiza highScore cuando lo supera', async () => {
    const answers = [makeAnswerResult({ points: 600 }), makeAnswerResult({ points: 600 })];
    mocks.findUnique.mockResolvedValue({ highScore: 500, gamesPlayed: 10 });

    await saveGameResult('u1', answers, undefined, GameMode.SINGLE, undefined, GameVariant.CLASSIC);

    const updateCall = mocks.update.mock.calls[0]?.[0] as { data?: Record<string, unknown> } | undefined;
    const data = updateCall?.data ?? {};
    expect(data.highScore).toBe(1200);
  });

  it('Flag Master (SINGLE + FLAG_MASTER) NO actualiza highScore', async () => {
    const answers = Array.from({ length: 10 }, () => makeAnswerResult({ points: 240 }));

    const result = await saveGameResult('u1', answers, undefined, GameMode.SINGLE, undefined, GameVariant.FLAG_MASTER);

    expect(result.isHighScore).toBe(false);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ variant: GameVariant.FLAG_MASTER }) })
    );

    const updateCall = mocks.update.mock.calls[0]?.[0] as { data?: Record<string, unknown> } | undefined;
    const data = updateCall?.data ?? {};
    expect(data.highScore).toBeUndefined();
  });

  it('GeoRetos (SINGLE + GEO_CHALLENGE) NO actualiza highScore', async () => {
    const answers = Array.from({ length: 5 }, () => makeAnswerResult({ points: 100 }));

    const result = await saveGameResult('u1', answers, undefined, GameMode.SINGLE, undefined, GameVariant.GEO_CHALLENGE);

    expect(result.isHighScore).toBe(false);
    const updateCall = mocks.update.mock.calls[0]?.[0] as { data?: Record<string, unknown> } | undefined;
    const data = updateCall?.data ?? {};
    expect(data.highScore).toBeUndefined();
  });

  it('Flash (SINGLE + FLASH) NO actualiza highScore', async () => {
    const answers = [makeAnswerResult({ points: 1000 })];

    const result = await saveGameResult('u1', answers, undefined, GameMode.SINGLE, undefined, GameVariant.FLASH);

    expect(result.isHighScore).toBe(false);
  });

  it('Streak (SINGLE + STREAK) NO actualiza highScore', async () => {
    const answers = [makeAnswerResult({ points: 2000 })];

    const result = await saveGameResult('u1', answers, undefined, GameMode.SINGLE, undefined, GameVariant.STREAK);

    expect(result.isHighScore).toBe(false);
  });

  it('DUEL con CLASSIC NO actualiza highScore porque no es SINGLE', async () => {
    const answers = [makeAnswerResult({ points: 2000 })];

    const result = await saveGameResult('u1', answers, undefined, GameMode.DUEL, undefined, GameVariant.CLASSIC);

    expect(result.isHighScore).toBe(false);
  });

  it('guarda el variant correcto para cada modo de juego', async () => {
    const variants = [
      GameVariant.CLASSIC,
      GameVariant.STREAK,
      GameVariant.FLASH,
      GameVariant.FLAG_MASTER,
      GameVariant.GEO_CHALLENGE,
    ];

    for (const variant of variants) {
      mocks.create.mockClear();
      await saveGameResult('u1', [makeAnswerResult()], undefined, GameMode.SINGLE, undefined, variant);

      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ variant }) })
      );
    }
  });

  it('incrementa gamesPlayed para cualquier variante', async () => {
    await saveGameResult('u1', [makeAnswerResult()], undefined, GameMode.SINGLE, undefined, GameVariant.FLAG_MASTER);

    const updateCall = mocks.update.mock.calls[0]?.[0] as { data?: Record<string, unknown> } | undefined;
    const data = updateCall?.data ?? {};
    expect(data.gamesPlayed).toEqual({ increment: 1 });
  });
});

describe('getCategoryStats — solo Classic', () => {
  it('filtra por SINGLE + CLASSIC', async () => {
    mocks.findMany.mockResolvedValueOnce([]);

    await getCategoryStats('u1');

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', gameMode: 'SINGLE', variant: GameVariant.CLASSIC },
      })
    );
  });
});
