import express from 'express';
import type { RequestHandler } from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Category } from '@prisma/client';
import gameRouter from '../controllers/game.controller.js';
import { evaluateAchievementsAfterDaily } from '../services/achievement.service.js';
import { applyMasteryAttemptsForRun } from '../services/mastery.service.js';
import { trackServerEvent } from '../services/telemetry.service.js';

const QUESTION_POOL = Array.from({ length: 12 }, (_, i) => {
  const continents = ['Africa', 'Asia', 'Europe', 'Oceania', 'North America', 'South America'];
  const categories = [Category.FLAG, Category.CAPITAL, Category.SILHOUETTE, Category.MONUMENT];
  const continent = continents[i % continents.length];
  return {
    id: `daily-q${i + 1}`,
    category: categories[i % categories.length],
    questionText: '',
    questionData: `Pais ${i + 1}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    imageUrl: null,
    continent,
    countryCode: `CC${String(i + 1).padStart(2, '0')}`,
    subregion: null,
    isInsular: false,
    isLandlocked: false,
    populationTier: null,
    areaTier: null,
    difficulty: null,
  };
});

const mocks = vi.hoisted(() => ({
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  questionFindMany: vi.fn(),
  questionFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  gameResultCreate: vi.fn(),
  gameResultFindFirst: vi.fn(),
  gameResultFindUnique: vi.fn(),
  dailyPlanFindUnique: vi.fn(),
  dailyPlanCreate: vi.fn(),
  dailyPlanFindMany: vi.fn(),
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
    question: { findMany: mocks.questionFindMany, findUnique: mocks.questionFindUnique },
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    gameResult: { findFirst: mocks.gameResultFindFirst, create: mocks.gameResultCreate, findUnique: mocks.gameResultFindUnique },
    dailyChallengePlan: {
      findUnique: mocks.dailyPlanFindUnique,
      create: mocks.dailyPlanCreate,
      findMany: mocks.dailyPlanFindMany,
    },
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

vi.mock('../services/telemetry.service.js', () => ({
  trackServerEvent: vi.fn(),
}));

vi.mock('../services/mastery.service.js', () => ({
  applyMasteryAttemptsForRun: vi.fn().mockResolvedValue(undefined),
}));

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/game', gameRouter);
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, baseUrl };
}

function startServerWithOptionalUser() {
  const app = express();
  app.use(express.json());
  const attachUser: RequestHandler = (req, _res, next) => {
    (req as typeof req & { user?: { userId: string } }).user = { userId: 'user-1' };
    next();
  };
  app.use(attachUser);
  app.use('/api/game', gameRouter);
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, baseUrl };
}

const FIXED_DAY_KEY = '2026-08-13';

function fixedPlan(dayKey = FIXED_DAY_KEY) {
  return {
    dayKey,
    version: 'world-tour-v1',
    questionIds: QUESTION_POOL.slice(0, 10).map((q) => q.id),
    stops: QUESTION_POOL.slice(0, 10).map((q, i) => ({
      questionId: q.id,
      countryCode: q.countryCode,
      category: q.category,
      region: ['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA'][i % 5],
      difficulty: q.difficulty,
    })),
  };
}

function mockPersistedDailyPlan(dayKey = FIXED_DAY_KEY) {
  const plan = fixedPlan(dayKey);
  mocks.dailyPlanFindUnique.mockResolvedValue(plan);
  mocks.dailyPlanFindMany.mockResolvedValue([]);
  mocks.questionFindUnique.mockImplementation((args: { where: { id: string } }) => {
    const q = QUESTION_POOL.find((item) => item.id === args.where.id);
    return Promise.resolve(q ? { correctAnswer: q.correctAnswer } : null);
  });
  mocks.questionFindMany.mockImplementation((args: any) => {
    const ids: string[] = args?.where?.id?.in ?? plan.questionIds;
    return Promise.resolve(QUESTION_POOL.filter((q) => ids.includes(q.id)));
  });
  return plan;
}

describe('GET /api/game/daily — resiliencia ante caída de Redis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dailyPlanFindUnique.mockResolvedValue(null);
    mocks.dailyPlanCreate.mockResolvedValue({
      dayKey: new Date().toISOString().slice(0, 10),
      version: 'world-tour-v1',
      questionIds: QUESTION_POOL.slice(0, 10).map((q) => q.id),
      stops: QUESTION_POOL.slice(0, 10).map((q, i) => ({
        questionId: q.id,
        countryCode: q.countryCode,
        category: q.category,
        region: ['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA'][i % 5],
        difficulty: q.difficulty,
      })),
    });
    mocks.dailyPlanFindMany.mockResolvedValue([]);
    mocks.questionFindMany.mockImplementation((args: any) => {
      if (args?.select?.id && !args?.select?.countryCode) {
        return Promise.resolve(QUESTION_POOL.map((q) => ({ id: q.id })));
      }
      if (args?.select?.countryCode) {
        return Promise.resolve(QUESTION_POOL.map((q) => ({
          id: q.id,
          category: q.category,
          countryCode: q.countryCode,
          continent: q.continent,
          difficulty: q.difficulty,
        })));
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
    mocks.dailyPlanFindUnique.mockResolvedValue({
      dayKey: new Date().toISOString().slice(0, 10),
      version: 'world-tour-v1',
      questionIds: cachedIds,
      stops: QUESTION_POOL.slice(0, 10).map((q, i) => ({
        questionId: q.id,
        countryCode: q.countryCode,
        category: q.category,
        region: ['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA'][i % 5],
        difficulty: q.difficulty,
      })),
    });
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

describe('Daily controller authority contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T22:30:00.000Z'));
    mocks.redisGet.mockResolvedValue(null);
    mocks.redisSet.mockResolvedValue('OK');
    mockPersistedDailyPlan();
    mocks.userFindUnique.mockResolvedValue({ highScore: 0, dailyStreak: 0, lastDailyDate: null });
    mocks.userUpdate.mockResolvedValue({});
    mocks.gameResultCreate.mockResolvedValue({});
    mocks.gameResultFindUnique.mockResolvedValue(null);
    mocks.gameResultFindFirst.mockResolvedValue(null);
    vi.mocked(evaluateAchievementsAfterDaily).mockResolvedValue([]);
    vi.mocked(applyMasteryAttemptsForRun).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('GET /daily does not leak countryCode or correctAnswer before answering', async () => {
    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily?clientDate=${FIXED_DAY_KEY}`);
    const body = (await response.json()) as {
      questions: Array<Record<string, unknown>>;
      tour: { stops: Array<Record<string, unknown>> };
    };
    server.close();

    expect(response.status).toBe(200);
    for (const question of body.questions) {
      expect(question).not.toHaveProperty('countryCode');
      expect(question).not.toHaveProperty('correctAnswer');
    }
    for (const stop of body.tour.stops) {
      expect(stop).not.toHaveProperty('countryCode');
    }
  });

  it('Redis null still returns alreadyPlayed from DB and does not return questions', async () => {
    mocks.redisGet.mockResolvedValue(null);
    mocks.gameResultFindUnique.mockResolvedValueOnce({
      score: 900,
      correctCount: 9,
      totalQuestions: 10,
      createdAt: new Date('2026-08-13T23:00:00.000Z'),
      details: { stops: fixedPlan().stops.map((s) => ({ ...s, isCorrect: true, points: 100 })) },
    });
    mocks.userFindUnique.mockResolvedValueOnce({ dailyStreak: 6 });

    const { server, baseUrl } = startServerWithOptionalUser();
    const response = await fetch(`${baseUrl}/api/game/daily?clientDate=${FIXED_DAY_KEY}`);
    const body = (await response.json()) as {
      alreadyPlayed: boolean;
      questions?: unknown[];
      result: { score: number; dailyStreak?: number; details?: unknown[] };
    };
    server.close();

    expect(response.status).toBe(200);
    expect(body.alreadyPlayed).toBe(true);
    expect(body.questions).toBeUndefined();
    expect(body.result.score).toBe(900);
    expect(body.result.dailyStreak).toBe(6);
    expect(body.result.details).toHaveLength(10);
    expect(mocks.dailyPlanFindUnique).not.toHaveBeenCalled();
    expect(mocks.questionFindMany).not.toHaveBeenCalled();
  });

  it("answer='' is persisted as incorrect and reveals country only after answer", async () => {
    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: 'daily-q1', answer: '', dayKey: FIXED_DAY_KEY }),
    });
    const body = (await response.json()) as { isCorrect: boolean; points: number; countryCode?: string };
    server.close();

    expect(response.status).toBe(200);
    expect(body.isCorrect).toBe(false);
    expect(body.points).toBe(0);
    expect(body.countryCode).toBe('CC01');

    const [, persisted] = mocks.redisSet.mock.calls[0];
    expect(JSON.parse(persisted)).toMatchObject({
      questionId: 'daily-q1',
      isCorrect: false,
      points: 0,
      countryCode: 'CC01',
    });
  });

  it('valid explicit dayKey within drift is preserved for answer and submit', async () => {
    const validNextDay = '2026-08-14';
    mockPersistedDailyPlan(validNextDay);

    const { server, baseUrl } = startServer();
    const answer = await fetch(`${baseUrl}/api/game/daily/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: 'daily-q1', answer: 'A', dayKey: validNextDay }),
    });
    const submit = await fetch(`${baseUrl}/api/game/daily/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dayKey: validNextDay }),
    });
    server.close();

    expect(answer.status).toBe(200);
    expect(submit.status).toBe(200);
    expect(mocks.redisSet.mock.calls.some((call) => call[0] === `daily:answer:user-1:${validNextDay}:daily-q1`)).toBe(true);
    expect(mocks.gameResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ runId: `daily:user-1:${validNextDay}` }),
      })
    );
  });

  it('spoofed explicit dayKey +5 days falls back to server day for answer and submit', async () => {
    const spoofedDay = '2026-08-18';
    mockPersistedDailyPlan(FIXED_DAY_KEY);

    const { server, baseUrl } = startServer();
    const answer = await fetch(`${baseUrl}/api/game/daily/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: 'daily-q1', answer: 'A', dayKey: spoofedDay }),
    });
    const submit = await fetch(`${baseUrl}/api/game/daily/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dayKey: spoofedDay }),
    });
    server.close();

    expect(answer.status).toBe(200);
    expect(submit.status).toBe(200);
    expect(mocks.dailyPlanFindUnique).toHaveBeenCalledWith({ where: { dayKey: FIXED_DAY_KEY } });
    expect(mocks.dailyPlanFindUnique).not.toHaveBeenCalledWith({ where: { dayKey: spoofedDay } });
    expect(mocks.redisSet.mock.calls.some((call) => call[0] === `daily:answer:user-1:${FIXED_DAY_KEY}:daily-q1`)).toBe(true);
    expect(mocks.gameResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ runId: `daily:user-1:${FIXED_DAY_KEY}` }),
      })
    );
  });

  it('malformed explicit dayKey does not create a DailyChallengePlan for that malformed key', async () => {
    const malformedDay = 'not-a-date';
    mockPersistedDailyPlan(FIXED_DAY_KEY);

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: 'daily-q1', answer: 'A', dayKey: malformedDay }),
    });
    server.close();

    expect(response.status).toBe(200);
    expect(mocks.dailyPlanFindUnique).toHaveBeenCalledWith({ where: { dayKey: FIXED_DAY_KEY } });
    expect(mocks.dailyPlanFindUnique).not.toHaveBeenCalledWith({ where: { dayKey: malformedDay } });
    expect(mocks.dailyPlanCreate).not.toHaveBeenCalled();
  });

  it('first answer wins and retry returns the stored winner', async () => {
    const winner = {
      questionId: 'daily-q1',
      isCorrect: false,
      correctAnswer: 'A',
      points: 0,
      countryCode: 'CC01',
      region: 'AFRICA',
    };
    mocks.redisGet.mockResolvedValueOnce(JSON.stringify(winner));

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: 'daily-q1', answer: 'A', dayKey: FIXED_DAY_KEY }),
    });
    const body = await response.json();
    server.close();

    expect(response.status).toBe(200);
    expect(body).toEqual(winner);
    expect(mocks.redisSet).not.toHaveBeenCalled();
    expect(mocks.questionFindUnique).not.toHaveBeenCalled();
  });

  it('/answer Redis failure returns 503', async () => {
    mocks.redisGet.mockRejectedValueOnce(new Error('redis down'));

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: 'daily-q1', answer: 'A', dayKey: FIXED_DAY_KEY }),
    });
    const body = (await response.json()) as { code?: string };
    server.close();

    expect(response.status).toBe(503);
    expect(body.code).toBe('GAME_STATE_UNAVAILABLE');
  });

  it('question outside the daily plan is rejected', async () => {
    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: 'not-in-plan', answer: 'A', dayKey: FIXED_DAY_KEY }),
    });
    server.close();

    expect(response.status).toBe(400);
    expect(mocks.redisSet).not.toHaveBeenCalled();
    expect(mocks.questionFindUnique).not.toHaveBeenCalled();
  });

  it('submit stores exactly 10 details, runId metadata, and 10 mastery attempts', async () => {
    mocks.redisGet.mockImplementation((key: string) => {
      if (key === `daily:played:user-1:${FIXED_DAY_KEY}`) return Promise.resolve(null);
      if (key === `daily:answer:user-1:${FIXED_DAY_KEY}:daily-q1`) {
        return Promise.resolve(JSON.stringify({ isCorrect: true, points: 100 }));
      }
      if (key === `daily:answer:user-1:${FIXED_DAY_KEY}:daily-q2`) {
        return Promise.resolve(JSON.stringify({ isCorrect: false, points: 0 }));
      }
      return Promise.resolve(null);
    });

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dayKey: FIXED_DAY_KEY }),
    });
    const body = (await response.json()) as {
      result: { score: number; correctCount: number; details: Array<{ isCorrect: boolean; points: number }> };
    };
    server.close();

    expect(response.status).toBe(200);
    expect(body.result.score).toBe(100);
    expect(body.result.correctCount).toBe(1);
    expect(body.result.details).toHaveLength(10);
    expect(body.result.details[1]).toMatchObject({ isCorrect: false, points: 0 });
    expect(body.result.details[9]).toMatchObject({ isCorrect: false, points: 0 });

    expect(mocks.gameResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          runId: `daily:user-1:${FIXED_DAY_KEY}`,
          details: expect.objectContaining({
            dailyVersion: 'world-tour-v1',
            dayKey: FIXED_DAY_KEY,
            stops: expect.any(Array),
          }),
        }),
      })
    );
    const masteryCall = vi.mocked(applyMasteryAttemptsForRun).mock.calls[0];
    expect(masteryCall[2]).toBe(`daily:user-1:${FIXED_DAY_KEY}`);
    expect(masteryCall[5]).toHaveLength(10);
    expect(masteryCall[5]).toContainEqual({ questionId: 'daily-q2', isCorrect: false });
    expect(masteryCall[5]).toContainEqual({ questionId: 'daily-q10', isCorrect: false });
  });

  it('repeated submit for an already completed day does not duplicate counters or GameResult', async () => {
    mocks.userFindUnique.mockResolvedValue({ highScore: 0, dailyStreak: 4, lastDailyDate: FIXED_DAY_KEY });
    mocks.gameResultFindUnique.mockResolvedValue({
      score: 700,
      correctCount: 7,
      totalQuestions: 10,
      createdAt: new Date('2026-08-13T23:00:00.000Z'),
      details: { stops: [] },
    });

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dayKey: FIXED_DAY_KEY }),
    });
    const body = (await response.json()) as { result: { score: number; dailyStreak?: number } };
    server.close();

    expect(response.status).toBe(200);
    expect(body.result.score).toBe(700);
    expect(body.result.dailyStreak).toBe(4);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.gameResultCreate).not.toHaveBeenCalled();
    expect(applyMasteryAttemptsForRun).not.toHaveBeenCalled();
  });

  it('concurrent submit P2002 recovers the winning GameResult without a second result write', async () => {
    mocks.userFindUnique
      .mockResolvedValueOnce({ highScore: 0, dailyStreak: 5, lastDailyDate: '2026-08-12' })
      .mockResolvedValueOnce({ dailyStreak: 6 });
    mocks.gameResultCreate.mockRejectedValueOnce({ code: 'P2002' });
    mocks.gameResultFindUnique.mockResolvedValueOnce({
      score: 500,
      correctCount: 5,
      totalQuestions: 10,
      createdAt: new Date('2026-08-13T23:00:00.000Z'),
      details: { stops: fixedPlan().stops.map((s) => ({ ...s, isCorrect: false, points: 0 })) },
    });

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dayKey: FIXED_DAY_KEY }),
    });
    const body = (await response.json()) as { result: { score: number; correctCount: number; dailyStreak: number; details: unknown[] } };
    server.close();

    expect(response.status).toBe(200);
    expect(body.result.score).toBe(500);
    expect(body.result.correctCount).toBe(5);
    expect(body.result.dailyStreak).toBe(6);
    expect(body.result.details).toHaveLength(10);
    expect(mocks.gameResultCreate).toHaveBeenCalledTimes(1);
    expect(mocks.userUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dailyStreak: 6,
          gamesPlayed: { increment: 1 },
        }),
      })
    );
    expect(trackServerEvent).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'game_finished' }));
  });

  it('answer and submit keep the GET dayKey after server midnight', async () => {
    vi.setSystemTime(new Date('2026-08-14T03:30:00.000Z'));
    mockPersistedDailyPlan(FIXED_DAY_KEY);

    const { server, baseUrl } = startServer();
    const answer = await fetch(`${baseUrl}/api/game/daily/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: 'daily-q1', answer: 'A', dayKey: FIXED_DAY_KEY }),
    });
    const submit = await fetch(`${baseUrl}/api/game/daily/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dayKey: FIXED_DAY_KEY }),
    });
    server.close();

    expect(answer.status).toBe(200);
    expect(submit.status).toBe(200);
    expect(mocks.redisSet.mock.calls.some((call) => call[0] === `daily:answer:user-1:${FIXED_DAY_KEY}:daily-q1`)).toBe(true);
    expect(mocks.gameResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ runId: `daily:user-1:${FIXED_DAY_KEY}` }),
      })
    );
  });
});

describe('POST /api/game/daily/submit — el servidor calcula el puntaje', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redisGet.mockResolvedValue(null);
    mocks.redisSet.mockResolvedValue('OK');
    mocks.dailyPlanFindUnique.mockResolvedValue(null);
    mocks.dailyPlanCreate.mockResolvedValue({
      dayKey: new Date().toISOString().slice(0, 10),
      version: 'world-tour-v1',
      questionIds: QUESTION_POOL.slice(0, 10).map((q) => q.id),
      stops: QUESTION_POOL.slice(0, 10).map((q, i) => ({
        questionId: q.id,
        countryCode: q.countryCode,
        category: q.category,
        region: ['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA'][i % 5],
        difficulty: q.difficulty,
      })),
    });
    mocks.dailyPlanFindMany.mockResolvedValue([]);
    mocks.questionFindMany.mockImplementation((args: any) => {
      if (args?.select?.countryCode) {
        return Promise.resolve(QUESTION_POOL.map((q) => ({
          id: q.id,
          category: q.category,
          countryCode: q.countryCode,
          continent: q.continent,
          difficulty: q.difficulty,
        })));
      }
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

  it('recalcula score y correctCount desde las respuestas stored (ignora body del cliente)', async () => {
    const { server, baseUrl } = startServer();
    const ids = await getDailyQuestionIds(baseUrl);

    // Mock Redis to return stored answers: first 7 correct, last 3 incorrect
    const today = new Date().toISOString().slice(0, 10);
    mocks.redisGet.mockImplementation((key: string) => {
      if (key.startsWith('daily:answer:user-1:')) {
        const qid = key.split(':').pop();
        const idx = ids.indexOf(qid ?? '');
        return Promise.resolve(JSON.stringify({ isCorrect: idx >= 0 && idx < 7, correctAnswer: 'A', points: idx < 7 ? 100 : 0 }));
      }
      if (key === `daily:questions:${today}`) return Promise.resolve(JSON.stringify(ids));
      if (key === `daily:played:user-1:${today}`) return Promise.resolve(null);
      return Promise.resolve(null);
    });

    // Client sends all wrong answers — server ignores them, uses stored
    const answers = ids.map((questionId) => ({ questionId, answer: 'WRONG' }));
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

  it('ignora preguntas que no son del reto del día (scoring desde stored)', async () => {
    const { server, baseUrl } = startServer();

    // Mock Redis: no stored answers → correctCount = 0
    const today = new Date().toISOString().slice(0, 10);
    const ids = await getDailyQuestionIds(baseUrl);
    mocks.redisGet.mockImplementation((key: string) => {
      if (key === `daily:questions:${today}`) return Promise.resolve(JSON.stringify(ids));
      if (key === `daily:played:user-1:${today}`) return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const response = await fetch(`${baseUrl}/api/game/daily/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers: [{ questionId: 'hacked-question', answer: 'A' }] }),
    });

    server.close();

    expect(response.status).toBe(200);
    const body = (await response.json()) as { result?: { correctCount: number } };
    expect(body.result?.correctCount).toBe(0); // no stored answers = 0 score
  });
});

describe('POST /api/game/daily/submit — clientDate y racha en zona horaria local', () => {
  // Servidor fijo en UTC 2026-03-02T02:00:00Z. Un usuario en UTC-4 jugando a
  // las 22:00 del 2026-03-01 local ve "hoy" como 2026-03-01, pero el servidor
  // ya está en 2026-03-02. Sin clientDate, getTodayKey() usaría 2026-03-02.
  const SERVER_NOW = '2026-03-02T02:00:00.000Z';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(SERVER_NOW));
    mocks.redisGet.mockResolvedValue(null);
    mocks.redisSet.mockResolvedValue('OK');
    mocks.dailyPlanFindUnique.mockResolvedValue(null);
    mocks.dailyPlanCreate.mockResolvedValue({
      dayKey: '2026-03-01',
      version: 'world-tour-v1',
      questionIds: QUESTION_POOL.slice(0, 10).map((q) => q.id),
      stops: QUESTION_POOL.slice(0, 10).map((q, i) => ({
        questionId: q.id,
        countryCode: q.countryCode,
        category: q.category,
        region: ['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA'][i % 5],
        difficulty: q.difficulty,
      })),
    });
    mocks.dailyPlanFindMany.mockResolvedValue([]);
    mocks.questionFindMany.mockImplementation((args: any) => {
      if (args?.select?.countryCode) {
        return Promise.resolve(QUESTION_POOL.map((q) => ({
          id: q.id,
          category: q.category,
          countryCode: q.countryCode,
          continent: q.continent,
          difficulty: q.difficulty,
        })));
      }
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
    vi.mocked(evaluateAchievementsAfterDaily).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function getDailyQuestionIds(baseUrl: string): Promise<string[]> {
    const response = await fetch(`${baseUrl}/api/game/daily`);
    const body = (await response.json()) as { questions: Array<{ id: string }> };
    return body.questions.map((q) => q.id);
  }

  it('(a) clientDate un día detrás de la fecha UTC del servidor mantiene la racha si jugó "ayer" localmente', async () => {
    // El usuario jugó ayer local (2026-02-28) y hoy es 2026-03-01 local
    // (aunque el servidor ya esté en 2026-03-02 UTC).
    mocks.userFindUnique.mockResolvedValue({
      highScore: 0,
      dailyStreak: 5,
      lastDailyDate: '2026-02-28',
    });

    const { server, baseUrl } = startServer();
    const ids = await getDailyQuestionIds(baseUrl);
    const answers = ids.map((questionId) => ({ questionId, answer: 'A' }));

    const response = await fetch(`${baseUrl}/api/game/daily/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers, clientDate: '2026-03-01' }),
    });
    const body = (await response.json()) as { result: { dailyStreak: number } };
    server.close();

    expect(response.status).toBe(200);
    // Racha continúa (5 -> 6), no se resetea a 1 por el desfase UTC.
    expect(body.result.dailyStreak).toBe(6);
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dailyStreak: 6, lastDailyDate: '2026-03-01' }),
      })
    );
  });

  it('(b) clientDate spoofeado 3+ días de diferencia se ignora y cae al fallback UTC', async () => {
    mocks.userFindUnique.mockResolvedValue({
      highScore: 0,
      dailyStreak: 5,
      // "Ayer" respecto al fallback UTC (2026-03-02) es 2026-03-01.
      lastDailyDate: '2026-03-01',
    });

    const { server, baseUrl } = startServer();
    const ids = await getDailyQuestionIds(baseUrl);
    const answers = ids.map((questionId) => ({ questionId, answer: 'A' }));

    // Intento de spoofing: clientDate 5 días adelante del servidor.
    const response = await fetch(`${baseUrl}/api/game/daily/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers, clientDate: '2026-03-07' }),
    });
    const body = (await response.json()) as { result: { dailyStreak: number } };
    server.close();

    expect(response.status).toBe(200);
    // Se ignora el clientDate spoofeado: usa el fallback UTC (2026-03-02),
    // que SÍ es "hoy" tras "ayer" (2026-03-01) -> la racha continúa (5 -> 6).
    expect(body.result.dailyStreak).toBe(6);
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dailyStreak: 6, lastDailyDate: '2026-03-02' }),
      })
    );
  });

  it('(c) una racha genuinamente rota reporta previousStreak y streakLost', async () => {
    mocks.userFindUnique.mockResolvedValue({
      highScore: 0,
      dailyStreak: 4,
      // Hace 3 días — ni "hoy" ni "ayer" respecto al día resuelto (2026-03-01).
      lastDailyDate: '2026-02-26',
    });

    const { server, baseUrl } = startServer();
    const ids = await getDailyQuestionIds(baseUrl);
    const answers = ids.map((questionId) => ({ questionId, answer: 'A' }));

    const response = await fetch(`${baseUrl}/api/game/daily/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers, clientDate: '2026-03-01' }),
    });
    const body = (await response.json()) as {
      result: { dailyStreak: number; previousStreak?: number; streakLost?: boolean };
    };
    server.close();

    expect(response.status).toBe(200);
    expect(body.result.dailyStreak).toBe(1);
    expect(body.result.previousStreak).toBe(4);
    expect(body.result.streakLost).toBe(true);
  });

  it('perder una racha de 1 día no marca streakLost (no vale la pena flaggear)', async () => {
    mocks.userFindUnique.mockResolvedValue({
      highScore: 0,
      dailyStreak: 1,
      lastDailyDate: '2026-02-26',
    });

    const { server, baseUrl } = startServer();
    const ids = await getDailyQuestionIds(baseUrl);
    const answers = ids.map((questionId) => ({ questionId, answer: 'A' }));

    const response = await fetch(`${baseUrl}/api/game/daily/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers, clientDate: '2026-03-01' }),
    });
    const body = (await response.json()) as { result: { streakLost?: boolean; previousStreak?: number } };
    server.close();

    expect(response.status).toBe(200);
    expect(body.result.streakLost).toBeUndefined();
    expect(body.result.previousStreak).toBeUndefined();
  });

  it('(d) sin clientDate sigue funcionando exactamente como antes (compatibilidad con PWA cacheada)', async () => {
    mocks.userFindUnique.mockResolvedValue({
      highScore: 0,
      dailyStreak: 5,
      // "Ayer" respecto al fallback UTC (2026-03-02) es 2026-03-01.
      lastDailyDate: '2026-03-01',
    });

    const { server, baseUrl } = startServer();
    const ids = await getDailyQuestionIds(baseUrl);
    const answers = ids.map((questionId) => ({ questionId, answer: 'A' }));

    const response = await fetch(`${baseUrl}/api/game/daily/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    const body = (await response.json()) as { result: { dailyStreak: number } };
    server.close();

    expect(response.status).toBe(200);
    expect(body.result.dailyStreak).toBe(6);
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dailyStreak: 6, lastDailyDate: '2026-03-02' }),
      })
    );
  });
});

describe('GET /api/game/daily/status — estado ligero para el lobby', () => {
  const SERVER_NOW = '2026-08-12T12:00:00.000Z';
  const TODAY = '2026-08-12';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(SERVER_NOW));
    mocks.redisGet.mockResolvedValue(null);
    mocks.redisSet.mockResolvedValue('OK');
    mocks.questionFindMany.mockResolvedValue([]);
    mocks.dailyPlanFindUnique.mockResolvedValue(null);
    mocks.dailyPlanFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('usuario que no jugó hoy → completed=false', async () => {
    mocks.userFindUnique.mockResolvedValue({
      dailyStreak: 3,
      lastDailyDate: '2026-08-10',
    });

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily/status`);
    const body = (await response.json()) as { completed: boolean; today: string; dailyStreak: number };
    server.close();

    expect(response.status).toBe(200);
    expect(body.completed).toBe(false);
    expect(body.today).toBe(TODAY);
    expect(body.dailyStreak).toBe(3);
    expect(body).not.toHaveProperty('result');
  });

  it('usuario que jugó hoy → completed=true', async () => {
    mocks.userFindUnique.mockResolvedValue({
      dailyStreak: 5,
      lastDailyDate: TODAY,
    });

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily/status`);
    const body = (await response.json()) as { completed: boolean };
    server.close();

    expect(response.status).toBe(200);
    expect(body.completed).toBe(true);
  });

  it('devuelve dailyStreak del usuario', async () => {
    mocks.userFindUnique.mockResolvedValue({
      dailyStreak: 7,
      lastDailyDate: null,
    });

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily/status`);
    const body = (await response.json()) as { dailyStreak: number };
    server.close();

    expect(body.dailyStreak).toBe(7);
  });

  it('devuelve resultado desde Redis cuando existe', async () => {
    mocks.userFindUnique.mockResolvedValue({
      dailyStreak: 4,
      lastDailyDate: TODAY,
    });

    const redisResult = {
      score: 800,
      correctCount: 8,
      totalQuestions: 10,
      playedAt: '2026-08-12T10:00:00.000Z',
    };
    mocks.redisGet.mockImplementation((key: string) => {
      if (key === `daily:played:user-1:${TODAY}`) {
        return Promise.resolve(JSON.stringify(redisResult));
      }
      return Promise.resolve(null);
    });

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily/status`);
    const body = (await response.json()) as { result?: { score: number; correctCount: number } };
    server.close();

    expect(body.result?.score).toBe(800);
    expect(body.result?.correctCount).toBe(8);
  });

  it('fallback a DB si Redis no tiene resultado', async () => {
    mocks.userFindUnique.mockResolvedValue({
      dailyStreak: 2,
      lastDailyDate: TODAY,
    });

    mocks.redisGet.mockResolvedValue(null);

    mocks.gameResultFindFirst.mockResolvedValue({
      score: 600,
      correctCount: 6,
      totalQuestions: 10,
      createdAt: new Date('2026-08-12T09:00:00.000Z'),
    });

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily/status`);
    const body = (await response.json()) as { result?: { score: number } };
    server.close();

    expect(body.result?.score).toBe(600);
  });

  it('respeta clientDate cuando es válido', async () => {
    mocks.userFindUnique.mockResolvedValue({
      dailyStreak: 3,
      lastDailyDate: '2026-08-11',
    });

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily/status?clientDate=2026-08-11`);
    const body = (await response.json()) as { completed: boolean; today: string };
    server.close();

    expect(response.status).toBe(200);
    expect(body.today).toBe('2026-08-11');
    expect(body.completed).toBe(true);
  });

  it('NO consulta preguntas del día', async () => {
    mocks.userFindUnique.mockResolvedValue({
      dailyStreak: 0,
      lastDailyDate: null,
    });

    const { server, baseUrl } = startServer();
    await fetch(`${baseUrl}/api/game/daily/status`);
    server.close();

    expect(mocks.questionFindMany).not.toHaveBeenCalled();
    expect(mocks.dailyPlanFindUnique).not.toHaveBeenCalled();
    expect(mocks.dailyPlanFindMany).not.toHaveBeenCalled();
    expect(mocks.dailyPlanCreate).not.toHaveBeenCalled();
  });

  it('NO emite game_started ni modifica DB', async () => {
    mocks.userFindUnique.mockResolvedValue({
      dailyStreak: 1,
      lastDailyDate: null,
    });

    const { server, baseUrl } = startServer();
    await fetch(`${baseUrl}/api/game/daily/status`);
    server.close();

    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.gameResultCreate).not.toHaveBeenCalled();
    expect(trackServerEvent).not.toHaveBeenCalled();
  });

  it('usuario nuevo sin lastDailyDate → completed=false, streak=0', async () => {
    mocks.userFindUnique.mockResolvedValue({
      dailyStreak: 0,
      lastDailyDate: null,
    });

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily/status`);
    const body = (await response.json()) as { completed: boolean; dailyStreak: number };
    server.close();

    expect(body.completed).toBe(false);
    expect(body.dailyStreak).toBe(0);
  });

  it('DB fallback devuelve resultado DAILY (no último juego del día)', async () => {
    mocks.userFindUnique.mockResolvedValue({
      dailyStreak: 3,
      lastDailyDate: TODAY,
    });

    mocks.redisGet.mockResolvedValue(null);

    // Simulate: most recent gameResult is a Classic (non-DAILY) played after the Daily
    mocks.gameResultFindFirst.mockResolvedValue({
      score: 700,
      correctCount: 7,
      totalQuestions: 10,
      createdAt: new Date('2026-08-12T11:00:00.000Z'),
    });

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/game/daily/status`);
    server.close();

    // The query should filter by variant: DAILY, not by createdAt range
    expect(mocks.gameResultFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          variant: 'DAILY',
        }),
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { result?: { score: number } };
    expect(body.result?.score).toBe(700);
  });
});
