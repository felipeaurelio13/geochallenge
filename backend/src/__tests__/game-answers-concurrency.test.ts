/**
 * Redis answer source-of-truth: fields in `game:session:<sessionId>`.
 *
 * - First-wins atómico con HSETNX.
 * - Las respuestas viven junto a la metadata de la sesión.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const redisStore = new Map<string, string>();
  const hashStore = new Map<string, Map<string, string>>();
  return {
    redisStore,
    hashStore,
  };
});

vi.mock('../config/database.js', () => ({ prisma: {} }));
vi.mock('../config/env.js', () => ({
  config: { game: { questionsPerGame: 10, timePerQuestion: 10, maxTimeBonus: 50, basePoints: 100, enableStreakSimpleScoring: true, soloModeScoringStrategy: 'simple_1_0', enableStreakUniqueQuestions: true, mechanics: { limits: { int5050: 1, focusTime: 1, streakShield: 0 } } }, jwt: { secret: 'test-secret', expiresIn: '7d' } },
}));
vi.mock('../config/redis.js', () => ({
  getRedis: () => ({
    // Simula la Lua de storeAnswerResult sobre el hash único de sesión.
    eval: vi.fn((_script: string, numkeys: number, ...rest: unknown[]) => {
      const keys = rest.slice(0, numkeys) as string[];
      const args = rest.slice(numkeys) as string[];
      const sessionKey = keys[0];
      const field = args[0];
      const serialized = args[1];
      if (!mocks.redisStore.has(sessionKey)) return Promise.resolve([-1, null]);
      if (!mocks.hashStore.has(sessionKey)) mocks.hashStore.set(sessionKey, new Map());
      const h = mocks.hashStore.get(sessionKey)!;
      if (h.has(field)) return Promise.resolve([0, h.get(field)]);
      h.set(field, serialized);
      return Promise.resolve([1, serialized]);
    }),
    hget: vi.fn((key: string, field: string) => Promise.resolve(mocks.hashStore.get(key)?.get(field) ?? null)),
    hmget: vi.fn((key: string, ...fields: string[]) => Promise.resolve(fields.map((field) => mocks.hashStore.get(key)?.get(field) ?? null))),
  }),
}));

import { readCanonicalAnswers, storeAnswerResult } from '../services/game.service.js';

function makeResult(questionId: string, isCorrect: boolean, points: number) {
  return {
    questionId,
    isCorrect,
    correctAnswer: 'Correct',
    userAnswer: isCorrect ? 'Correct' : 'Wrong',
    points,
    timeRemaining: 5,
  };
}

describe('storeAnswerResult — session hash first-wins (Lua)', () => {
  beforeEach(() => {
    mocks.redisStore.clear();
    mocks.hashStore.clear();
  });

  it('dos answers concurrentes a la misma pregunta: la primera gana', async () => {
    mocks.redisStore.set('game:session:s1', 'session');
    const [a, b] = await Promise.all([
      storeAnswerResult('s1', 'q-1', makeResult('q-1', true, 100)),
      storeAnswerResult('s1', 'q-1', makeResult('q-1', false, 0)),
    ]);
    expect(a.stored.isCorrect).toBe(true);
    expect(b.stored.isCorrect).toBe(true);
    expect(a.stored).toEqual(b.stored);
    expect([a.isFirstAnswer, b.isFirstAnswer]).toEqual(expect.arrayContaining([true, false]));
  });

  it('answers concurrentes a preguntas distintas: ambas sobreviven', async () => {
    mocks.redisStore.set('game:session:s1', 'session');
    await Promise.all([
      storeAnswerResult('s1', 'q-1', makeResult('q-1', true, 100)),
      storeAnswerResult('s1', 'q-2', makeResult('q-2', false, 0)),
    ]);
    const canonical = await readCanonicalAnswers('s1', ['q-1', 'q-2']);
    expect(canonical['q-1'].isCorrect).toBe(true);
    expect(canonical['q-2'].isCorrect).toBe(false);
    expect(Object.keys(canonical).length).toBe(2);
  });

  it('repetir answer no modifica el resultado original', async () => {
    mocks.redisStore.set('game:session:s1', 'session');
    await storeAnswerResult('s1', 'q-1', makeResult('q-1', true, 100));
    const again = await storeAnswerResult('s1', 'q-1', makeResult('q-1', false, 0));
    expect(again.isFirstAnswer).toBe(false);
    expect(again.stored.isCorrect).toBe(true);
    expect(again.stored.points).toBe(100);
  });

  it('readCanonicalAnswers resuelve campos answer por questionId', async () => {
    mocks.redisStore.set('game:session:s1', 'session');
    await storeAnswerResult('s1', 'q-1', makeResult('q-1', true, 100));
    await storeAnswerResult('s1', 'q-2', makeResult('q-2', false, 0));

    const canonical = await readCanonicalAnswers('s1', ['q-1', 'q-2', 'q-3']);
    expect(canonical['q-1'].isCorrect).toBe(true);
    expect(canonical['q-2'].isCorrect).toBe(false);
    expect(Object.keys(canonical).length).toBe(2);
    expect(canonical['q-3']).toBeUndefined();
  });

  it('no crea claves Redis paralelas para respuestas', async () => {
    mocks.redisStore.set('game:session:s1', 'session');
    await storeAnswerResult('s1', 'q-1', makeResult('q-1', true, 100));
    expect([...mocks.hashStore.keys()]).toEqual(['game:session:s1']);
  });
});
