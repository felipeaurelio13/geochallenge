import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Category } from '@prisma/client';
import gameRouter from '../controllers/game.controller.js';
import { evaluateAchievementsAfterDaily } from '../services/achievement.service.js';

const QUESTION_POOL = Array.from({ length: 12 }, (_, i) => ({
  id: `daily-q${i + 1}`,
  category: Category.FLAG,
  questionText: '',
  questionData: `Pais ${i + 1}`,
  options: ['A', 'B', 'C', 'D'],
  correctAnswer: 'A',
  imageUrl: null,
  continent: null,
  subregion: null,
  isInsular: false,
  isLandlocked: false,
  populationTier: null,
  areaTier: null,
}));

const mocks = vi.hoisted(() => ({
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  questionFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  gameResultCreate: vi.fn(),
  gameResultFindFirst: vi.fn(),
}));

vi.mock('../middleware/auth.js', () => ({
  authenticateJWT: (req: { user?: { userId: string } }, _res: unknown, next: () => void) => {
    req.user = { userId: 'user-1' };
    next();
  },
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../config/redis.js', () => ({
  getRedis: () => ({ get: mocks.redisGet, set: mocks.redisSet }),
}));

vi.mock('../config/database.js', () => {
  const prisma = {
    question: { findMany: mocks.questionFindMany },
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    gameResult: { findFirst: mocks.gameResultFindFirst, create: mocks.gameResultCreate },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { prisma };
});

vi.mock('../config/env.js', () => ({
  config: { game: { questionsPerGame: 10, timePerQuestion: 10, maxTimeBonus: 50 } },
}));

vi.mock('../services/game.service.js', () => ({
  generateQuestionText: (q: { id: string }) => `Pregunta ${q.id}`,
  getQuestionsForGame: vi.fn(),
  getQuestionsForStreakGame: vi.fn(),
  getStreakBatchSize: vi.fn(),
  getQuestionsForFlashGame: vi.fn(),
  getAvailableQuestionsCount: vi.fn(),
  getFlashDurationSeconds: vi.fn(),
  getMechanicsConfigForMode: vi.fn(),
  validateAnswerByGameType: vi.fn(),
  saveGameResult: vi.fn(),
  getUserGameHistory: vi.fn(),
  getDuelMatchHistory: vi.fn(),
  getDuelMatchStats: vi.fn(),
  getDuelOpponents: vi.fn(),
  getDuelHeadToHead: vi.fn(),
  getCategoryStats: vi.fn(),
}));

vi.mock('../services/achievement.service.js', () => ({
  evaluateAchievementsAfterGame: vi.fn().mockResolvedValue([]),
  evaluateAchievementsAfterDaily: vi.fn().mockResolvedValue([]),
  getUserAchievements: vi.fn(),
}));

vi.mock('../services/leaderboard.service.js', () => ({
  updateLeaderboardScore: vi.fn(),
  updateSeasonLeaderboardScore: vi.fn(),
}));

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/game', gameRouter);
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, baseUrl };
}

describe('GET /api/game/daily — resiliencia ante caída de Redis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.questionFindMany.mockImplementation((args: any) => {
      if (args?.select?.id) {
        return Promise.resolve(QUESTION_POOL.map((q) => ({ id: q.id })));
      }
      const ids: string[] = args?.where?.id?.in ?? [];
      return Promise.resolve(QUESTION_POOL.filter((q) => ids.includes(q.id)));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('devuelve preguntas jugables (200) cuando Redis tira max-retries en vez de un 500', async () => {
    mocks.redisGet.mockRejectedValue(
      new Error('Reached the max retries per request limit (which is 3).')
    );
    const { server, baseUrl } = startServer();

    const response = await fetch(`${baseUrl}/api/game/daily`);
    const body = (await response.json()) as {
      questions?: Array<{ id: string }>;
      alreadyPlayed?: boolean;
    };

    server.close();

    expect(response.status).toBe(200);
    expect(body.alreadyPlayed).toBe(false);
    expect(body.questions).toHaveLength(10);
    // Con Redis caído la caché no debe escribirse.
    expect(mocks.redisSet).not.toHaveBeenCalled();
  });

  it('sigue usando la caché de Redis cuando está disponible', async () => {
    const cachedIds = QUESTION_POOL.slice(0, 10).map((q) => q.id);
    mocks.redisGet.mockResolvedValue(JSON.stringify(cachedIds));
    const { server, baseUrl } = startServer();

    const response = await fetch(`${baseUrl}/api/game/daily`);
    const body = (await response.json()) as { questions?: Array<{ id: string }> };

    server.close();

    expect(response.status).toBe(200);
    expect(body.questions).toHaveLength(10);
    // No se regeneró: sólo se consultó el detalle de las preguntas cacheadas.
    expect(mocks.questionFindMany).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/game/daily/submit — el servidor calcula el puntaje', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redisGet.mockResolvedValue(null);
    mocks.redisSet.mockResolvedValue('OK');
    mocks.questionFindMany.mockImplementation((args: any) => {
      if (args?.select?.id && !args?.where?.id) {
        return Promise.resolve(QUESTION_POOL.map((q) => ({ id: q.id })));
      }
      const ids: string[] = args?.where?.id?.in ?? [];
      return Promise.resolve(
        QUESTION_POOL.filter((q) => ids.includes(q.id)).map((q) =>
          args?.select?.correctAnswer ? { id: q.id, correctAnswer: q.correctAnswer } : q
        )
      );
    });
    mocks.userFindUnique.mockResolvedValue({ highScore: 0, dailyStreak: 0, lastDailyDate: null });
    mocks.userUpdate.mockResolvedValue({});
    mocks.gameResultCreate.mockResolvedValue({});
    // restoreAllMocks del describe anterior borra la implementación del factory.
    vi.mocked(evaluateAchievementsAfterDaily).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function getDailyQuestionIds(baseUrl: string): Promise<string[]> {
    const response = await fetch(`${baseUrl}/api/game/daily`);
    const body = (await response.json()) as { questions: Array<{ id: string }> };
    return body.questions.map((q) => q.id);
  }

  it('recalcula score y correctCount desde las respuestas (ignora lo que diga el cliente)', async () => {
    const { server, baseUrl } = startServer();
    const ids = await getDailyQuestionIds(baseUrl);

    // 7 correctas ('A') y 3 incorrectas
    const answers = ids.map((questionId, i) => ({ questionId, answer: i < 7 ? 'A' : 'B' }));
    const response = await fetch(`${baseUrl}/api/game/daily/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    const body = (await response.json()) as { result?: { score: number; correctCount: number } };

    server.close();

    expect(response.status).toBe(200);
    expect(body.result?.correctCount).toBe(7);
    expect(body.result?.score).toBe(700);
    expect(mocks.gameResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ score: 700, correctCount: 7 }) })
    );
  });

  it('rechaza el contrato legacy {score, correctCount} con mensaje de versión', async () => {
    const { server, baseUrl } = startServer();

    const response = await fetch(`${baseUrl}/api/game/daily/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ score: 99999, correctCount: 10, totalQuestions: 10 }),
    });
    const body = (await response.json()) as { error?: string };

    server.close();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/desactualizada/);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it('rechaza respuestas con preguntas que no son del reto del día', async () => {
    const { server, baseUrl } = startServer();

    const response = await fetch(`${baseUrl}/api/game/daily/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers: [{ questionId: 'hacked-question', answer: 'A' }] }),
    });

    server.close();

    expect(response.status).toBe(400);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });
});
