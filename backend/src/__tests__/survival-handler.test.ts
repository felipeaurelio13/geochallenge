import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeIo, makeFakeSocket, type FakeSocket } from './helpers/fakeSocketIo.js';

const mocks = vi.hoisted(() => ({
  getQuestionsForGame: vi.fn(),
  validateAnswer: vi.fn(),
  persistSurvivalFinalization: vi.fn(),
}));

vi.mock('../config/database.js', () => ({ prisma: {} }));

vi.mock('../services/game.service.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/game.service.js')>()),
  getQuestionsForGame: mocks.getQuestionsForGame,
  validateAnswer: mocks.validateAnswer,
}));

vi.mock('../services/survivalPersistence.service.js', () => ({
  persistSurvivalFinalization: mocks.persistSurvivalFinalization,
}));

vi.mock('../services/telemetry.service.js', () => ({
  trackServerEvent: vi.fn(),
}));

import { setupSurvivalHandlers } from '../sockets/survival.handler.js';

let questionSeq = 0;
function nextQuestions() {
  const id = `sq${++questionSeq}`;
  return [{ id, category: 'FLAG', questionText: '?', options: ['a', 'b'], correctAnswer: 'a', difficulty: 'EASY' }];
}

function answerResult(points: number, isCorrect = points > 0) {
  return { questionId: 'x', isCorrect, correctAnswer: 'a', userAnswer: 'a', points, timeRemaining: 5 };
}

function makeSockets(...userIds: string[]) {
  const sockets = userIds.map((id) => makeFakeSocket(id));
  const io = makeFakeIo(sockets);
  for (const s of sockets) setupSurvivalHandlers(io as any, s as any);
  return { sockets, io };
}

function errorCodes(socket: FakeSocket, io: ReturnType<typeof makeFakeIo>): string[] {
  return [
    ...socket.emitted.filter((e) => e.event === 'survival:error').map((e) => e.data.code),
    ...io.forSocket(socket.id, 'survival:error').map((d) => d.code),
  ];
}

describe('survival handler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.getQuestionsForGame.mockReset().mockImplementation(async () => nextQuestions());
    mocks.validateAnswer.mockReset();
    mocks.persistSurvivalFinalization.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function startPlayingMatch(idA: string, idB: string, category = 'FLAG') {
    const ctx = makeSockets(idA, idB);
    const [a, b] = ctx.sockets;
    await a.fire('survival:queue', { category });
    await b.fire('survival:queue', { category });
    expect(ctx.io.ofEvent('survival:matched')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(15_000 + 3_100); // fill window + countdown
    expect(ctx.io.ofEvent('survival:question')).toHaveLength(1);
    return { ...ctx, a, b };
  }

  describe('validación de payloads', () => {
    it('rechaza categoría inválida en survival:queue', async () => {
      const { sockets } = makeSockets('sv-a');
      await sockets[0].fire('survival:queue', { category: 'NOPE' });
      expect(sockets[0].last('survival:error')?.code).toBe('VALIDATION_FAILED');
    });

    it('rechaza coordenadas inválidas y respuestas largas en survival:answer', async () => {
      const { sockets } = makeSockets('sv2-a');
      const s = sockets[0];
      await s.fire('survival:answer', { questionId: 'q', answer: 'MAP_ANSWER', timeRemaining: 5, coordinates: { lat: 'x', lng: 1 } });
      await s.fire('survival:answer', { questionId: 'q', answer: 'MAP_ANSWER', timeRemaining: 5, coordinates: { lat: 0, lng: 181 } });
      await s.fire('survival:answer', { questionId: 'q', answer: 'x'.repeat(201), timeRemaining: 5 });
      await s.fire('survival:answer', undefined);
      expect(s.emitted.filter((e) => e.data?.code === 'VALIDATION_FAILED')).toHaveLength(4);
      expect(mocks.validateAnswer).not.toHaveBeenCalled();
    });
  });

  describe('fallo en createMatch', () => {
    it('notifica a todos y libera el estado (pueden re-encolarse)', async () => {
      mocks.getQuestionsForGame.mockRejectedValue(new Error('db down'));
      const { sockets, io } = makeSockets('cm-a', 'cm-b');
      const [a, b] = sockets;

      await a.fire('survival:queue', { category: 'SILHOUETTE' });
      await b.fire('survival:queue', { category: 'SILHOUETTE' });

      expect(errorCodes(a, io)).toContain('SURVIVAL_ERROR_GENERIC');
      expect(errorCodes(b, io)).toContain('SURVIVAL_ERROR_GENERIC');

      await a.fire('survival:queue', { category: 'SILHOUETTE' });
      expect(errorCodes(a, io)).not.toContain('SURVIVAL_ALREADY_IN_PROGRESS');
      expect(a.last('survival:queued')).toBeDefined();
      await a.fire('survival:dequeue');
    });
  });

  describe('pendingQueue', () => {
    it('unirse a una sala en llenado saca al usuario de pendingQueue (no queda en dos partidas)', async () => {
      const { sockets, io } = makeSockets('pq-a', 'pq-b', 'pq-c', 'pq-d');
      const [a, b, c, d] = sockets;

      await a.fire('survival:queue', { category: 'MAP' });
      await b.fire('survival:queue', { category: 'MAP' }); // sala MAP en llenado
      expect(io.ofEvent('survival:matched')).toHaveLength(1);

      await c.fire('survival:queue', { category: 'MONUMENT' }); // pendiente en otra categoría
      await c.fire('survival:queue', { category: 'MAP' }); // se une a la sala MAP
      expect(c.last('survival:matched')).toBeDefined();

      // d en MONUMENT: no debe emparejarse con c (que ya está en la sala MAP)
      await d.fire('survival:queue', { category: 'MONUMENT' });
      expect(d.last('survival:queued')).toBeDefined();
      expect(io.ofEvent('survival:matched')).toHaveLength(1);
      await d.fire('survival:dequeue');
    });

    it('un disconnect tardío de un socket viejo no borra la entrada del socket nuevo', async () => {
      const oldSocket = makeFakeSocket('st-u', 'old-socket');
      const newSocket = makeFakeSocket('st-u', 'new-socket');
      const other = makeFakeSocket('st-v');
      const io = makeFakeIo([oldSocket, newSocket, other]);
      for (const s of [oldSocket, newSocket, other]) setupSurvivalHandlers(io as any, s as any);

      await oldSocket.fire('survival:queue', { category: 'CAPITAL' });
      await newSocket.fire('survival:queue', { category: 'CAPITAL' }); // reemplaza la entrada
      expect(newSocket.last('survival:queued')).toBeDefined();

      await oldSocket.fire('disconnect');

      await other.fire('survival:queue', { category: 'CAPITAL' });
      expect(io.ofEvent('survival:matched')).toHaveLength(1); // u (socket nuevo) + v siguen emparejándose
    });
  });

  describe('eventCounts', () => {
    it('se limpian al desconectar el socket', async () => {
      const { sockets } = makeSockets('ec-a');
      const s = sockets[0];

      for (let i = 0; i < 10; i++) await s.fire('survival:queue', { category: 'NOPE' });
      await s.fire('survival:queue', { category: 'NOPE' });
      expect(s.last('survival:error')?.code).toBe('SURVIVAL_RATE_LIMITED');

      await s.fire('disconnect');

      await s.fire('survival:queue', { category: 'NOPE' });
      expect(s.last('survival:error')?.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('reemplazo de respuesta', () => {
    it('conserva la respuesta previa si la validación de la nueva lanza', async () => {
      const { a, io } = await startPlayingMatch('ra-a', 'ra-b', 'FLAG');
      const question = io.ofEvent('survival:question')[0].data.question;

      mocks.validateAnswer.mockResolvedValueOnce(answerResult(100));
      await a.fire('survival:answer', { questionId: question.id, answer: 'a', timeRemaining: 5 });
      mocks.validateAnswer.mockRejectedValueOnce(new Error('db down'));
      await a.fire('survival:answer', { questionId: question.id, answer: 'b', timeRemaining: 5 });

      await vi.advanceTimersByTimeAsync(18_000);
      const result = io.ofEvent('survival:question-result')[0].data;
      const resA = result.playerResults.find((r: any) => r.userId === 'ra-a');
      expect(resA.isCorrect).toBe(true);
      expect(resA.isTimeout).toBe(false);
      expect(resA.score).toBe(100);
    });

    it('reemplaza la respuesta cuando la nueva valida', async () => {
      const { a, io } = await startPlayingMatch('rb-a', 'rb-b', 'MONUMENT');
      const question = io.ofEvent('survival:question')[0].data.question;

      mocks.validateAnswer.mockResolvedValueOnce(answerResult(100));
      await a.fire('survival:answer', { questionId: question.id, answer: 'a', timeRemaining: 5 });
      mocks.validateAnswer.mockResolvedValueOnce(answerResult(0, false));
      await a.fire('survival:answer', { questionId: question.id, answer: 'b', timeRemaining: 5 });

      await vi.advanceTimersByTimeAsync(18_000);
      const result = io.ofEvent('survival:question-result')[0].data;
      expect(result.playerResults.find((r: any) => r.userId === 'rb-a').isCorrect).toBe(false);
    });
  });

  describe('persistencia al terminar', () => {
    it('limita los reintentos a 5, limpia el estado y emite error', async () => {
      mocks.persistSurvivalFinalization.mockRejectedValue(new Error('db down'));
      const { a, b, io } = await startPlayingMatch('pe-a', 'pe-b', 'MIXED');

      await a.fire('disconnect'); // b queda solo tras la gracia de 20s
      await vi.advanceTimersByTimeAsync(20_000);
      for (let i = 0; i < 8; i++) await vi.advanceTimersByTimeAsync(5_000);

      expect(mocks.persistSurvivalFinalization).toHaveBeenCalledTimes(5);
      expect(io.ofEvent('survival:error').some((e) => e.data.code === 'SURVIVAL_ERROR_GENERIC')).toBe(true);
      expect(io.ofEvent('survival:finished')).toHaveLength(0);

      await b.fire('survival:queue', { category: 'MIXED' });
      expect(errorCodes(b, io)).not.toContain('SURVIVAL_ALREADY_IN_PROGRESS');
      await b.fire('survival:dequeue');
    });
  });
});
