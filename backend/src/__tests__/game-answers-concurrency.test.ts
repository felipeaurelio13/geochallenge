/**
 * P1 — Redis answer source-of-truth: `game:answers:<sessionId>` hash.
 *
 * - First-wins atómico (legacy `game:answer:*` gana sobre hash en transición).
 * - Resolución por questionId: mixed sessions (legacy + hash) reconstruye todo.
 * - TTL del hash heredado del PTTL real de `game:session:<sid>`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const redisStore = new Map<string, string>();
  const hashStore = new Map<string, Map<string, string>>();
  return {
    redisStore,
    hashStore,
    pexpireMock: vi.fn(),
    ptttlMock: vi.fn(),
  };
});

vi.mock('../config/database.js', () => ({ prisma: {} }));
vi.mock('../config/env.js', () => ({
  config: { game: { questionsPerGame: 10, timePerQuestion: 10, maxTimeBonus: 50, basePoints: 100, enableStreakSimpleScoring: true, soloModeScoringStrategy: 'simple_1_0', enableStreakUniqueQuestions: true, mechanics: { limits: { int5050: 1, focusTime: 1, streakShield: 0 } } }, jwt: { secret: 'test-secret', expiresIn: '7d' } },
}));
vi.mock('../config/redis.js', () => ({
  getRedis: () => ({
    get: vi.fn((key: string) => Promise.resolve(mocks.redisStore.get(key) ?? null)),
    set: vi.fn((key: string, value: string) => { mocks.redisStore.set(key, value); return Promise.resolve('OK'); }),
    mget: vi.fn((keys: string[]) => Promise.resolve(keys.map((k: string) => mocks.redisStore.get(k) ?? null))),
    pexpire: mocks.pexpireMock,
    pttl: mocks.ptttlMock,
    // Simula la Lua de storeAnswerResult (legacy-ganó → HSETNX → PEXPIRE).
    eval: vi.fn((_script: string, numkeys: number, ...rest: unknown[]) => {
      const keys = rest.slice(0, numkeys) as string[];
      const args = rest.slice(numkeys) as string[];
      const sessionKey = keys[0];
      const answersHash = keys[1];
      const legacyKey = keys[2];
      const serialized = args[0];
      const questionId = args[1];

      const legacy = mocks.redisStore.get(legacyKey);
      if (legacy !== undefined && legacy !== null) return Promise.resolve([0, legacy]);

      const sessKey = sessionKey.replace('game:session:', '');
      const ttl = mocks.ptttlMock(sessionKey);
      if (ttl > 0) mocks.pexpireMock(answersHash, ttl);

      if (!mocks.hashStore.has(answersHash)) mocks.hashStore.set(answersHash, new Map());
      const h = mocks.hashStore.get(answersHash)!;
      if (h.has(questionId)) return Promise.resolve([0, h.get(questionId)]);
      h.set(questionId, serialized);
      return Promise.resolve([1, serialized]);
    }),
    hget: vi.fn((key: string, field: string) => Promise.resolve(mocks.hashStore.get(key)?.get(field) ?? null)),
    hgetall: vi.fn((key: string) => Promise.resolve(Object.fromEntries(mocks.hashStore.get(key) ?? []))),
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

describe('storeAnswerResult — hash game:answers:<sid> first-wins (Lua)', () => {
  beforeEach(() => {
    mocks.redisStore.clear();
    mocks.hashStore.clear();
    mocks.pexpireMock.mockClear();
    mocks.ptttlMock.mockReturnValue(7200000);
  });

  it('dos answers concurrentes a la misma pregunta: la primera gana', async () => {
    mocks.redisStore.set('game:session:s1', JSON.stringify({}));
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
    mocks.redisStore.set('game:session:s1', JSON.stringify({}));
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
    mocks.redisStore.set('game:session:s1', JSON.stringify({}));
    await storeAnswerResult('s1', 'q-1', makeResult('q-1', true, 100));
    const again = await storeAnswerResult('s1', 'q-1', makeResult('q-1', false, 0));
    expect(again.isFirstAnswer).toBe(false);
    expect(again.stored.isCorrect).toBe(true);
    expect(again.stored.points).toBe(100);
  });

  it('legacy gana sobre hash durante la transición (re-answer no entra)', async () => {
    mocks.redisStore.set('game:session:s1', JSON.stringify({}));
    mocks.redisStore.set('game:answer:s1:q-1', JSON.stringify(makeResult('q-1', true, 100)));
    // El hash todavía no tiene q1; una nueva respuesta NO debe sobreescribir el legacy.
    const res = await storeAnswerResult('s1', 'q-1', makeResult('q-1', false, 0));
    expect(res.isFirstAnswer).toBe(false);
    expect(res.stored.isCorrect).toBe(true);
    // El hash no se creó/escrivió: legacy ganó y nada se escribió en el hash.
    expect(mocks.hashStore.get('game:answers:s1')).toBeUndefined();
  });

  it('readCanonicalAnswers resuelve mixed: legacy + hash por questionId', async () => {
    mocks.redisStore.set('game:session:s1', JSON.stringify({}));
    // q-1 en legacy, q-2 en hash.
    mocks.redisStore.set('game:answer:s1:q-1', JSON.stringify(makeResult('q-1', true, 100)));
    await storeAnswerResult('s1', 'q-2', makeResult('q-2', false, 0));

    const canonical = await readCanonicalAnswers('s1', ['q-1', 'q-2', 'q-3']);
    expect(canonical['q-1'].isCorrect).toBe(true);
    expect(canonical['q-2'].isCorrect).toBe(false);
    expect(Object.keys(canonical).length).toBe(2);
    expect(canonical['q-3']).toBeUndefined();
  });

  it('TTL del hash heredado del PTTL real de la sesión', async () => {
    mocks.redisStore.set('game:session:s1', JSON.stringify({}));
    mocks.ptttlMock.mockReturnValue(3_600_000);
    await storeAnswerResult('s1', 'q-1', makeResult('q-1', true, 100));
    expect(mocks.ptttlMock).toHaveBeenCalledWith('game:session:s1');
    expect(mocks.pexpireMock).toHaveBeenCalledWith('game:answers:s1', 3_600_000);
  });
});
