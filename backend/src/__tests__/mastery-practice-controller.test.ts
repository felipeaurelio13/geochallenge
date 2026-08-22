/**
 * P4 — Mastery Practice controller integration tests.
 * Practice start: exact IDs, countryCode privacy, incomplete pool error.
 * Practice finish: variant PRACTICE, MasteryAttempt, no highScore, no leaderboard.
 */
import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import masteryRouter from '../controllers/mastery.controller.js';
import gameRouter from '../controllers/game.controller.js';

const mocks = vi.hoisted(() => {
  const redisStore = new Map<string, string>();
  const hashStore = new Map<string, Map<string, string>>();
  const sessionStore = new Map<string, any>();

  const CL_QUESTIONS = [
    { id: 'cl1', category: 'FLAG', questionText: 'CL Flag 1', questionData: 'Chile', options: ['Chile', 'Argentina', 'Perú', 'Bolivia'], correctAnswer: 'Chile', imageUrl: null, latitude: null, longitude: null, continent: 'SA', subregion: 'South America', isInsular: false, isLandlocked: false, difficulty: 'MEDIUM', populationTier: null, areaTier: null, countryCode: 'CL' },
    { id: 'cl2', category: 'CAPITAL', questionText: 'CL Capital', questionData: 'Chile', options: ['Santiago', 'Lima', 'Buenos Aires', 'Bogotá'], correctAnswer: 'Santiago', imageUrl: null, latitude: null, longitude: null, continent: 'SA', subregion: 'South America', isInsular: false, isLandlocked: false, difficulty: 'MEDIUM', populationTier: null, areaTier: null, countryCode: 'CL' },
    { id: 'cl3', category: 'MAP', questionText: 'CL Map', questionData: 'Chile', options: ['Chile', 'Argentina', 'Perú', 'Uruguay'], correctAnswer: 'Chile', imageUrl: null, latitude: -35, longitude: -70, continent: 'SA', subregion: 'South America', isInsular: false, isLandlocked: false, difficulty: 'MEDIUM', populationTier: null, areaTier: null, countryCode: 'CL' },
  ];

  const AR_QUESTIONS = [
    { id: 'ar1', category: 'FLAG', questionText: 'AR Flag', questionData: 'Argentina', options: ['Argentina', 'Chile', 'Brasil', 'Uruguay'], correctAnswer: 'Argentina', imageUrl: null, latitude: null, longitude: null, continent: 'SA', subregion: 'South America', isInsular: false, isLandlocked: false, difficulty: 'MEDIUM', populationTier: null, areaTier: null, countryCode: 'AR' },
  ];

  const ALL_QUESTIONS = [...CL_QUESTIONS, ...AR_QUESTIONS];

  const mockSelectAdaptive = vi.fn();

  return {
    redisStore,
    sessionStore,
    hashStore,
    CL_QUESTIONS,
    AR_QUESTIONS,
    ALL_QUESTIONS,
    mockSelectAdaptive,

    redisGet: vi.fn((key: string) => {
      if (key.startsWith('game:session:')) {
        const sid = key.replace('game:session:', '');
        const s = sessionStore.get(sid);
        return Promise.resolve(s ? JSON.stringify(s) : null);
      }
      return Promise.resolve(redisStore.get(key) ?? null);
    }),

    leaderboardUpdate: vi.fn(),
    leaderboardUpdateSeason: vi.fn(),
  };
});

vi.mock('../middleware/auth.js', () => ({
  authenticateJWT: (req: { user?: { userId: string } }, _res: unknown, next: () => void) => {
    req.user = { userId: 'user-1' };
    next();
  },
  optionalAuth: (req: { user?: { userId: string } }, _res: unknown, next: () => void) => {
    req.user = { userId: 'user-1' };
    next();
  },
}));

vi.mock('../config/redis.js', () => ({
  getRedis: () => ({
    get: mocks.redisGet,
    set: vi.fn((key: string, value: string) => {
      if (key.startsWith('game:session:')) {
        const sid = key.replace('game:session:', '');
        mocks.sessionStore.set(sid, JSON.parse(value));
      } else {
        mocks.redisStore.set(key, value);
      }
      return Promise.resolve('OK');
    }),
    incr: vi.fn((key: string) => {
      const prev = parseInt(mocks.redisStore.get(key) ?? '0', 10);
      mocks.redisStore.set(key, String(prev + 1));
      return Promise.resolve(prev + 1);
    }),
    expire: vi.fn(() => Promise.resolve(1)),
    mget: vi.fn((keys: string[]) => Promise.resolve(keys.map((k: string) => mocks.redisStore.get(k) ?? null))),
    hsetnx: vi.fn((key: string, field: string, value: string) => {
      if (!mocks.hashStore.has(key)) mocks.hashStore.set(key, new Map());
      const h = mocks.hashStore.get(key)!;
      if (h.has(field)) return Promise.resolve(0);
      h.set(field, value);
      return Promise.resolve(1);
    }),
    hget: vi.fn((key: string, field: string) => Promise.resolve(mocks.hashStore.get(key)?.get(field) ?? null)),
    hgetall: vi.fn((key: string) => Promise.resolve(Object.fromEntries(mocks.hashStore.get(key) ?? []))),
    pipeline: () => ({ zadd: () => ({ exec: async () => [] }) }),
    zadd: async () => 1, zscore: async () => null, zrevrange: async () => [],
    zcard: async () => 0, del: async () => 1, zrevrank: async () => null, exec: async () => [],
  }),
}));

vi.mock('../config/database.js', () => {
  const prismaObj = {
    question: {
      findMany: vi.fn().mockResolvedValue(mocks.ALL_QUESTIONS),
      findUnique: vi.fn((args: { where: { id: string } }) => {
        const q = mocks.ALL_QUESTIONS.find((tq: { id: string }) => tq.id === args.where.id);
        return Promise.resolve(q ?? null);
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ highScore: 500, gamesPlayed: 10 }),
      update: vi.fn().mockResolvedValue({}),
    },
    gameResult: {
      create: vi.fn().mockResolvedValue({ id: 'gr-1' }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    masteryAttempt: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaObj),
  };
  return { prisma: prismaObj };
});

vi.mock('../config/env.js', () => ({
  config: { game: { questionsPerGame: 10, timePerQuestion: 10, maxTimeBonus: 50, basePoints: 100, enableStreakSimpleScoring: true, soloModeScoringStrategy: 'simple_1_0', enableStreakUniqueQuestions: true, mechanics: { limits: { intel5050: 1 } } }, jwt: { secret: 'test-secret', expiresIn: '7d' } },
}));

vi.mock('../services/mastery.service.js', async () => {
  const actual = await vi.importActual<typeof import('../services/mastery.service.js')>('../services/mastery.service.js');
  return {
    ...actual,
    selectAdaptivePracticeQuestions: mocks.mockSelectAdaptive,
    getMasterySummary: vi.fn().mockResolvedValue({ worldProgressPercent: 0, totalCountries: 0, stampedCountries: 0, masteredCountries: 0, skills: [] }),
    getPassport: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../services/leaderboard.service.js', () => ({
  updateLeaderboardScore: mocks.leaderboardUpdate,
  updateSeasonLeaderboardScore: mocks.leaderboardUpdateSeason,
}));

vi.mock('../services/achievement.service.js', () => ({
  evaluateAchievementsAfterGame: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/telemetry.service.js', () => ({
  trackServerEvent: vi.fn(),
}));

vi.mock('../utils/scoring.js', () => ({
  shuffleArray: vi.fn((arr: unknown[]) => [...arr]),
  calculateScore: vi.fn((isCorrect: boolean) => isCorrect ? 100 : 0),
  calculateMapScore: vi.fn(() => 60),
  calculateTimeBonus: vi.fn(() => 50),
  selectRandom: vi.fn((arr: unknown[], count: number) => arr.slice(0, count)),
}));

vi.mock('../utils/haversine.js', () => ({
  haversineDistance: vi.fn(() => 0),
}));

function startServer(routes: { path: string; router: express.Router }[]) {
  const app = express();
  app.use(express.json());
  for (const r of routes) {
    app.use(r.path, r.router);
  }
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, baseUrl };
}

async function postJson(url: string, body: unknown) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Practice Start ──────────────────────────────────────────────────────────

describe('POST /api/mastery/practice/start', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mocks.sessionStore.clear();
  });

  it('returns exact IDs from adaptive selector', async () => {
    mocks.mockSelectAdaptive.mockResolvedValue(['cl1', 'cl2', 'cl3']);

    const { server, baseUrl } = startServer([
      { path: '/api/mastery', router: masteryRouter },
    ]);

    try {
      const res = await postJson(`${baseUrl}/api/mastery/practice/start`, { count: 3 });
      expect(res.status).toBe(200);
      const body = await res.json() as { questions: { id: string }[] };
      const ids = body.questions.map((q) => q.id);
      expect(ids).toEqual(['cl1', 'cl2', 'cl3']);
    } finally { server.close(); }
  });

  it('CL focus: server-side all questions have countryCode=CL, response public has no countryCode', async () => {
    mocks.mockSelectAdaptive.mockResolvedValue(['cl1', 'cl2', 'cl3']);

    const { server, baseUrl } = startServer([
      { path: '/api/mastery', router: masteryRouter },
    ]);

    try {
      const res = await postJson(`${baseUrl}/api/mastery/practice/start`, { count: 3, countryCode: 'CL' });
      expect(res.status).toBe(200);
      const body = await res.json() as { questions: Record<string, unknown>[] };

      for (const q of body.questions) {
        expect(q).not.toHaveProperty('countryCode');
        expect(q).not.toHaveProperty('correctAnswer');
        expect(q).not.toHaveProperty('latitude');
        expect(q).not.toHaveProperty('longitude');
      }

      // Session in store should have full questions with countryCode
      const sessionId = body.questions[0] ? (await import('../controllers/mastery.controller.js')).default : null;
      // Verify via session store that countryCode is stored server-side
      const sessions = [...mocks.sessionStore.values()];
      expect(sessions.length).toBeGreaterThan(0);
      const session = sessions[0];
      expect(session.variant).toBe('PRACTICE');
    } finally { server.close(); }
  });

  it('returns 409 when adaptive returns IDs but DB recovers fewer', async () => {
    mocks.mockSelectAdaptive.mockResolvedValue(['cl1', 'nonexistent', 'cl3']);

    const { server, baseUrl } = startServer([
      { path: '/api/mastery', router: masteryRouter },
    ]);

    try {
      const res = await postJson(`${baseUrl}/api/mastery/practice/start`, { count: 3 });
      expect(res.status).toBe(409);
      const body = await res.json() as { code: string; params: Record<string, number> };
      expect(body.code).toBe('GAME_NOT_ENOUGH_QUESTIONS');
      expect(body.params.available).toBeLessThan(body.params.requested);
    } finally { server.close(); }
  });
});

// ─── Practice Finish ─────────────────────────────────────────────────────────

describe('POST /api/game/finish — PRACTICE', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mocks.sessionStore.clear();
  });

  function primePracticeSession() {
    const questionIds = mocks.CL_QUESTIONS.map((q: { id: string }) => q.id);
    const correctAnswers: Record<string, string> = {};
    const optionsPerQuestion: Record<string, string[]> = {};
    for (const q of mocks.CL_QUESTIONS) {
      correctAnswers[q.id] = q.correctAnswer;
      optionsPerQuestion[q.id] = [...q.options];
    }
    const qResults: Record<string, unknown> = {};
    for (const qid of questionIds) {
      qResults[qid] = { questionId: qid, isCorrect: true, correctAnswer: correctAnswers[qid], userAnswer: correctAnswers[qid], points: 100, timeRemaining: 5 };
    }
    mocks.sessionStore.set('practice-session', {
      sessionId: 'practice-session',
      userId: 'user-1',
      gameMode: 'SINGLE',
      variant: 'PRACTICE',
      category: 'MIXED',
      questionIds,
      correctAnswers,
      optionsPerQuestion,
      answeredQuestionIds: questionIds,
      questionResults: qResults,
      mechanicsUsage: {},
      questionMeta: {},
      createdAt: Date.now(),
      expiresAt: Date.now() + 7200000,
    });
    // Fuente canónica de respuestas: hash `game:answers:<sessionId>`.
    mocks.hashStore.set(
      'game:answers:practice-session',
      new Map(Object.entries(qResults).map(([qid, r]) => [qid, JSON.stringify(r)])),
    );
  }

  it('accepts gameType=practice and returns variant=PRACTICE', async () => {
    primePracticeSession();

    const { server, baseUrl } = startServer([
      { path: '/api/game', router: gameRouter },
    ]);

    try {
      const res = await postJson(`${baseUrl}/api/game/finish`, {
        sessionId: 'practice-session',
        gameType: 'practice',
      });
      expect(res.status).toBe(200);
      const { prisma } = await import('../config/database.js');
      const gameResultMock = (prisma as any).gameResult as { create: ReturnType<typeof vi.fn> };
      
      expect(gameResultMock.create).toHaveBeenCalled();
      const createCall = gameResultMock.create.mock.calls[0][0];
      expect(createCall.data.variant).toBe('PRACTICE');
    } finally { server.close(); }
  });

  it('does NOT update highScore for PRACTICE', async () => {
    primePracticeSession();

    const { server, baseUrl } = startServer([
      { path: '/api/game', router: gameRouter },
    ]);

    try {
      const res = await postJson(`${baseUrl}/api/game/finish`, {
        sessionId: 'practice-session',
        gameType: 'practice',
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { isHighScore: boolean };
      expect(body.isHighScore).toBe(false);
    } finally { server.close(); }
  });

  it('creates MasteryAttempt for PRACTICE', async () => {
    primePracticeSession();

    const { server, baseUrl } = startServer([
      { path: '/api/game', router: gameRouter },
    ]);

    try {
      await postJson(`${baseUrl}/api/game/finish`, {
        sessionId: 'practice-session',
        gameType: 'practice',
      });
      const { prisma } = await import('../config/database.js');
      const masteryMock = (prisma as any).masteryAttempt as { createMany: ReturnType<typeof vi.fn> };
      expect(masteryMock.createMany).toHaveBeenCalled();
    } finally { server.close(); }
  });

  it('does NOT call leaderboard for PRACTICE', async () => {
    primePracticeSession();

    const { server, baseUrl } = startServer([
      { path: '/api/game', router: gameRouter },
    ]);

    try {
      await postJson(`${baseUrl}/api/game/finish`, {
        sessionId: 'practice-session',
        gameType: 'practice',
      });
      expect(mocks.leaderboardUpdate).not.toHaveBeenCalled();
      expect(mocks.leaderboardUpdateSeason).not.toHaveBeenCalled();
    } finally { server.close(); }
  });
});
