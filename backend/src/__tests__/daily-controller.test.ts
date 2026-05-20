import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Category } from '@prisma/client';
import gameRouter from '../controllers/game.controller.js';

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
}));

vi.mock('../middleware/auth.js', () => ({
  authenticateJWT: (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../config/redis.js', () => ({
  getRedis: () => ({ get: mocks.redisGet, set: mocks.redisSet }),
}));

vi.mock('../config/database.js', () => ({
  prisma: {
    question: { findMany: mocks.questionFindMany },
    user: { findUnique: vi.fn(), update: vi.fn() },
    gameResult: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

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
  evaluateAchievementsAfterGame: vi.fn(),
  evaluateAchievementsAfterDaily: vi.fn(),
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
