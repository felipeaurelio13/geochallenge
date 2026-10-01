import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeIo, makeFakeSocket, type FakeSocket } from './helpers/fakeSocketIo.js';

const mocks = vi.hoisted(() => ({
  getQuestionsForGame: vi.fn(),
  validateAnswer: vi.fn(),
  persistDuelResults: vi.fn(),
  evaluateAchievements: vi.fn(),
  questionFindMany: vi.fn(),
}));

vi.mock('../config/redis.js', () => ({
  getRedis: () => ({
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    getdel: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock('../config/database.js', () => ({
  prisma: {
    question: { findMany: mocks.questionFindMany },
    competitiveRating: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('../services/game.service.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/game.service.js')>()),
  getQuestionsForGame: mocks.getQuestionsForGame,
  validateAnswer: mocks.validateAnswer,
}));

vi.mock('../services/duelPersistence.service.js', () => ({
  persistDuelResults: mocks.persistDuelResults,
}));

vi.mock('../services/achievement.service.js', () => ({
  evaluateAchievementsAfterGame: mocks.evaluateAchievements,
}));

vi.mock('../services/telemetry.service.js', () => ({
  trackServerEvent: vi.fn(),
}));

import { MatchmakingQueue, setupDuelHandlers } from '../sockets/duel.handler.js';

const QUESTIONS = [
  { id: 'q1', category: 'FLAG', questionText: '?', options: ['a', 'b'], correctAnswer: 'a', difficulty: 'EASY' },
  { id: 'q2', category: 'FLAG', questionText: '?', options: ['a', 'b'], correctAnswer: 'a', difficulty: 'EASY' },
];

function answerResult(points: number) {
  return { questionId: 'q1', isCorrect: points > 0, correctAnswer: 'a', userAnswer: 'a', points, timeRemaining: 5 };
}

function setup(idA: string, idB: string) {
  const a = makeFakeSocket(idA);
  const b = makeFakeSocket(idB);
  const io = makeFakeIo([a, b]);
  const queue = new MatchmakingQueue();
  setupDuelHandlers(io as any, a as any, queue);
  setupDuelHandlers(io as any, b as any, queue);
  return { a, b, io, queue };
}

function errorCodes(socket: FakeSocket, io: ReturnType<typeof makeFakeIo>): string[] {
  return [
    ...socket.emitted.filter((e) => e.event === 'duel:error').map((e) => e.data.code),
    ...io.forSocket(socket.id, 'duel:error').map((d) => d.code),
  ];
}

describe('duel handler hardening', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.getQuestionsForGame.mockReset().mockResolvedValue(QUESTIONS);
    mocks.validateAnswer.mockReset();
    mocks.persistDuelResults.mockReset().mockResolvedValue({ persisted: true, ratingChanges: [] });
    mocks.evaluateAchievements.mockReset().mockResolvedValue([]);
    mocks.questionFindMany.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function startPlayingDuel(idA: string, idB: string) {
    const ctx = setup(idA, idB);
    await ctx.a.fire('duel:queue', { category: 'FLAG' });
    await ctx.b.fire('duel:queue', { category: 'FLAG' });
    await ctx.a.fire('duel:ready');
    await ctx.b.fire('duel:ready');
    await vi.advanceTimersByTimeAsync(3_100);
    expect(ctx.io.ofEvent('duel:question')).toHaveLength(1);
    return ctx;
  }

  describe('payload validation', () => {
    it('rechaza filters inválidos en duel:queue sin encolar', async () => {
      const { a, queue } = setup('v-a', 'v-b');
      await a.fire('duel:queue', { category: 'FLAG', filters: { difficulty: 'X' } });
      expect(a.last('duel:error')?.code).toBe('VALIDATION_FAILED');
      expect(queue.getQueueSize()).toBe(0);
    });

    it('rechaza categoría inválida y payload no-objeto', async () => {
      const { a, queue } = setup('v2-a', 'v2-b');
      await a.fire('duel:queue', { category: 'NOPE' });
      await a.fire('duel:queue', 'hola');
      expect(a.emitted.filter((e) => e.data?.code === 'VALIDATION_FAILED')).toHaveLength(2);
      expect(queue.getQueueSize()).toBe(0);
    });

    it('acepta el payload que envía el frontend (campos undefined/null)', async () => {
      const { a, queue } = setup('v3-a', 'v3-b');
      await a.fire('duel:queue', { category: undefined, filters: null, mode: 'classic', rated: false });
      expect(a.last('duel:queued')).toBeDefined();
      expect(queue.getQueueSize()).toBe(1);
    });

    it('rechaza coordenadas no numéricas / fuera de rango y respuestas largas en duel:answer', async () => {
      const { a } = setup('v4-a', 'v4-b');
      await a.fire('duel:answer', { questionId: 'q1', answer: 'MAP_ANSWER', timeRemaining: 5, coordinates: { lat: '10', lng: 20 } });
      await a.fire('duel:answer', { questionId: 'q1', answer: 'MAP_ANSWER', timeRemaining: 5, coordinates: { lat: 91, lng: 20 } });
      await a.fire('duel:answer', { questionId: 'q1', answer: 'MAP_ANSWER', timeRemaining: 5, coordinates: { lat: 10, lng: Infinity } });
      await a.fire('duel:answer', { questionId: 'q1', answer: 'x'.repeat(201), timeRemaining: 5 });
      expect(a.emitted.filter((e) => e.data?.code === 'VALIDATION_FAILED')).toHaveLength(4);
      expect(mocks.validateAnswer).not.toHaveBeenCalled();
    });
  });

  describe('fallo en createDuel', () => {
    it('notifica a ambos jugadores y libera el estado (sin DUEL_ALREADY_IN_PROGRESS)', async () => {
      mocks.getQuestionsForGame.mockRejectedValue(new Error('db down'));
      const { a, b, io } = setup('c-a', 'c-b');

      await a.fire('duel:queue', { category: 'FLAG' });
      await b.fire('duel:queue', { category: 'FLAG' });

      expect(errorCodes(a, io)).toContain('DUEL_ERROR_GENERIC');
      expect(errorCodes(b, io)).toContain('DUEL_ERROR_GENERIC');

      await a.fire('duel:queue', { category: 'FLAG' });
      expect(errorCodes(a, io)).not.toContain('DUEL_ALREADY_IN_PROGRESS');
      expect(a.last('duel:queued')).toBeDefined();
    });

    it('un fallo en el listener (p.ej. DB) emite duel:error en vez de rechazar', async () => {
      const { a } = setup('c2-a', 'c2-b');
      const { prisma } = await import('../config/database.js');
      vi.mocked(prisma.competitiveRating.findUnique).mockRejectedValueOnce(new Error('boom'));

      await expect(a.fire('duel:queue', { rated: true })).resolves.toBeUndefined();
      expect(a.last('duel:error')?.code).toBe('DUEL_ERROR_GENERIC');
    });
  });

  describe('reemplazo de respuesta', () => {
    it('conserva la respuesta previa si la validación de la nueva lanza, y reemplaza puntaje si tiene éxito', async () => {
      const { a, b, io } = await startPlayingDuel('r-a', 'r-b');

      mocks.validateAnswer.mockResolvedValueOnce(answerResult(100));
      await a.fire('duel:answer', { questionId: 'q1', answer: 'a', timeRemaining: 5 });

      mocks.validateAnswer.mockRejectedValueOnce(new Error('db down'));
      await a.fire('duel:answer', { questionId: 'q1', answer: 'b', timeRemaining: 5 });

      // Cierre por timeout: la respuesta original sigue contando.
      await vi.advanceTimersByTimeAsync(13_000);
      const first = io.ofEvent('duel:questionResult')[0].data;
      const resA = first.results.find((r: any) => r.userId === 'r-a');
      expect(resA.answer.points).toBe(100);
      expect(resA.totalScore).toBe(100);
      expect(first.results.find((r: any) => r.userId === 'r-b').answer.points).toBe(0);
      void b;
    });

    it('reemplaza la respuesta y ajusta el puntaje en un solo paso', async () => {
      const { a, io } = await startPlayingDuel('r2-a', 'r2-b');

      mocks.validateAnswer.mockResolvedValueOnce(answerResult(100));
      await a.fire('duel:answer', { questionId: 'q1', answer: 'a', timeRemaining: 5 });
      mocks.validateAnswer.mockResolvedValueOnce(answerResult(40));
      await a.fire('duel:answer', { questionId: 'q1', answer: 'b', timeRemaining: 5 });

      await vi.advanceTimersByTimeAsync(13_000);
      const first = io.ofEvent('duel:questionResult')[0].data;
      const resA = first.results.find((r: any) => r.userId === 'r2-a');
      expect(resA.answer.points).toBe(40);
      expect(resA.totalScore).toBe(40);
    });
  });

  describe('endDuel', () => {
    it('evalúa logros con isDuel/isWin y los incluye en duel:finished', async () => {
      mocks.evaluateAchievements.mockImplementation(async (ctx: any) => (ctx.isWin ? ['FIRST_WIN'] : []));
      const { a, io } = await startPlayingDuel('e-a', 'e-b');

      await a.fire('duel:leave'); // gana e-b por abandono

      const calls = mocks.evaluateAchievements.mock.calls.map((c) => c[0]);
      expect(calls).toHaveLength(2);
      expect(calls.find((c) => c.userId === 'e-b')).toMatchObject({ isDuel: true, isWin: true });
      expect(calls.find((c) => c.userId === 'e-a')).toMatchObject({ isDuel: true, isWin: false });

      const finished = io.ofEvent('duel:finished')[0].data;
      expect(finished.winnerId).toBe('e-b');
      expect(finished.newAchievements).toEqual({ 'e-a': [], 'e-b': ['FIRST_WIN'] });
    });

    it('un fallo del evaluador de logros no rompe el cierre del duelo', async () => {
      mocks.evaluateAchievements.mockRejectedValue(new Error('achievements down'));
      const { a, io } = await startPlayingDuel('e2-a', 'e2-b');

      await a.fire('duel:leave');

      expect(io.ofEvent('duel:finished')).toHaveLength(1);
      expect(mocks.persistDuelResults).toHaveBeenCalledTimes(1);
      await a.fire('duel:queue', { category: 'FLAG' });
      expect(errorCodes(a, io)).not.toContain('DUEL_ALREADY_IN_PROGRESS');
    });

    it('limita los reintentos de persistencia a 5, limpia el estado y emite error', async () => {
      mocks.persistDuelResults.mockRejectedValue(new Error('db down'));
      const { a, io } = await startPlayingDuel('p-a', 'p-b');

      await a.fire('duel:leave');
      for (let i = 0; i < 8; i++) await vi.advanceTimersByTimeAsync(5_000);

      expect(mocks.persistDuelResults).toHaveBeenCalledTimes(5);
      expect(io.emitted.some((e) => e.to && e.event === 'duel:error' && e.data.code === 'DUEL_ERROR_GENERIC')).toBe(true);
      expect(io.ofEvent('duel:finished')).toHaveLength(0);

      await a.fire('duel:queue', { category: 'FLAG' });
      expect(errorCodes(a, io)).not.toContain('DUEL_ALREADY_IN_PROGRESS');
    });
  });

  describe('MatchmakingQueue.removePlayerIfSocket', () => {
    it('no remueve la entrada de un socket nuevo cuando desconecta uno viejo', () => {
      const queue = new MatchmakingQueue();
      queue.addPlayer({ userId: 'u', username: 'u', socketId: 'new-socket', joinedAt: new Date(), category: 'FLAG' });

      expect(queue.removePlayerIfSocket('u', 'old-socket')).toBeNull();
      expect(queue.isInQueue('u')).toBe(true);

      expect(queue.removePlayerIfSocket('u', 'new-socket')).not.toBeNull();
      expect(queue.isInQueue('u')).toBe(false);
    });
  });
});
