/**
 * P1 — Session integrity + answer leakage tests across all game modes.
 */
import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import gameRouter from '../controllers/game.controller.js';

const mocks = vi.hoisted(() => {
  const redisStore = new Map<string, string>();
  const sessionStore = new Map<string, ReturnType<typeof makeSession>>();
  const TEST_QUESTIONS = Array.from({ length: 10 }, (_, i) => {
    const continents = ['Africa', 'Asia', 'Europe', 'Oceania', 'North America', 'South America'];
    const categories = ['FLAG', 'CAPITAL', 'SILHOUETTE', 'MONUMENT', 'CINEMA_GEO'];
    return {
    id: `q-${i + 1}`,
    category: categories[i % categories.length],
    questionText: `Question ${i + 1}`,
    questionData: `Country ${i + 1}`,
    options: ['Correct', 'Wrong1', 'Wrong2', 'Wrong3'],
    correctAnswer: 'Correct',
    imageUrl: null,
    latitude: i === 0 ? 10.0 : undefined,
    longitude: i === 0 ? 20.0 : undefined,
    continent: continents[i % continents.length],
    countryCode: `CC${String(i + 1).padStart(2, '0')}`,
    subregion: 'Western Europe',
    isInsular: false,
    isLandlocked: false,
    isAvailable: true,
    difficulty: 'MEDIUM',
    populationTier: null,
    areaTier: null,
  };
  });

  function makeSession() {
    const correctAnswers: Record<string, string> = {};
    const optionsPerQuestion: Record<string, string[]> = {};
    for (const q of TEST_QUESTIONS) {
      correctAnswers[q.id] = q.correctAnswer;
      optionsPerQuestion[q.id] = [...q.options];
    }
    return {
      sessionId: 'test-session-1',
      userId: 'user-1',
      gameMode: 'SINGLE',
      variant: 'CLASSIC',
      category: 'MIXED',
      questionIds: TEST_QUESTIONS.map((q) => q.id),
      correctAnswers,
      optionsPerQuestion,
      answeredQuestionIds: [] as string[],
      questionResults: {} as Record<string, unknown>,
      mechanicsUsage: {} as Record<string, number>,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7200000,
    };
  }

  return {
    redisGet: vi.fn((key: string) => {
      if (key.startsWith('game:session:')) {
        const sid = key.replace('game:session:', '');
        const s = sessionStore.get(sid);
        if (!s) return Promise.resolve(null); // unknown session
        return Promise.resolve(JSON.stringify(s));
      }
      return Promise.resolve(redisStore.get(key) ?? null);
    }),
    redisSet: vi.fn((key: string, value: string) => {
      if (key.startsWith('game:session:')) {
        const sid = key.replace('game:session:', '');
        sessionStore.set(sid, JSON.parse(value));
      } else {
        redisStore.set(key, value);
      }
      return Promise.resolve('OK');
    }),
    sessionStore,
    redisStore,
    TEST_QUESTIONS,
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
    set: vi.fn((key: string, value: string, ...args: string[]) => {
      if (args.includes('NX')) {
        if (mocks.redisStore.has(key)) return Promise.resolve(null);
        mocks.redisStore.set(key, value);
        return Promise.resolve('OK');
      }
      mocks.redisStore.set(key, value);
      // Sync session keys to sessionStore for GET access
      if (key.startsWith('game:session:')) {
        const sid = key.replace('game:session:', '');
        mocks.sessionStore.set(sid, JSON.parse(value));
      }
      return Promise.resolve('OK');
    }),
    incr: vi.fn((key: string) => {
      const prev = parseInt(mocks.redisStore.get(key) ?? '0', 10);
      mocks.redisStore.set(key, String(prev + 1));
      return Promise.resolve(prev + 1);
    }),
    expire: vi.fn(() => Promise.resolve(1)),
    pipeline: () => ({ zadd: () => ({ exec: async () => [] }) }),
    zadd: async () => 1, zscore: async () => null, zrevrange: async () => [],
    zcard: async () => 0, del: async () => 1, zrevrank: async () => null, exec: async () => [],
  }),
}));

vi.mock('../config/database.js', () => {
  const prismaObj = {
    question: {
      findMany: vi.fn().mockResolvedValue(mocks.TEST_QUESTIONS),
      findUnique: vi.fn((args: { where: { id: string } }) => {
        const q = mocks.TEST_QUESTIONS.find((tq: { id: string }) => tq.id === args.where.id);
        return Promise.resolve(q ?? null);
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ highScore: 500, gamesPlayed: 10, dailyStreak: 0, lastDailyDate: null }),
      update: vi.fn().mockResolvedValue({}),
    },
    gameResult: {
      create: vi.fn().mockResolvedValue({ id: 'gr-1' }),
      findUnique: vi.fn().mockResolvedValue(null), // runId not found → create
    },
    dailyChallengePlan: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        dayKey: new Date().toISOString().slice(0, 10),
        version: 'world-tour-v1',
        questionIds: mocks.TEST_QUESTIONS.slice(0, 10).map((q: { id: string }) => q.id),
        stops: mocks.TEST_QUESTIONS.slice(0, 10).map((q: { id: string; continent?: string | null; countryCode?: string | null; category?: string; difficulty?: string | null }, i: number) => ({
          questionId: q.id,
          countryCode: q.countryCode ?? 'US',
          category: q.category ?? 'FLAG',
          region: ['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA'][i % 5],
          difficulty: q.difficulty ?? null,
        })),
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaObj),
  };
  return { prisma: prismaObj };
});

vi.mock('../config/env.js', () => ({
    config: { game: { questionsPerGame: 10, timePerQuestion: 10, maxTimeBonus: 50, basePoints: 100, enableStreakSimpleScoring: true, soloModeScoringStrategy: 'simple_1_0', enableStreakUniqueQuestions: true, mechanics: { limits: { intel5050: 1, focusTime: 1, streakShield: 0 } } }, jwt: { secret: 'test-secret', expiresIn: '7d' } },
}));

vi.mock('../services/game.service.js', async () => {
  const actual = await vi.importActual<typeof import('../services/game.service.js')>('../services/game.service.js');
  return {
    ...actual,
    getQuestionsForGame: vi.fn().mockResolvedValue(mocks.TEST_QUESTIONS),
    getQuestionsForStreakGame: vi.fn().mockResolvedValue(mocks.TEST_QUESTIONS.slice(0, 3)),
    getStreakBatchSize: vi.fn(() => 3),
    getMechanicsConfigForMode: vi.fn(() => ({ enabled: false, allowed: [] as string[], limits: {} })),
    getAvailableQuestionsCount: vi.fn().mockResolvedValue(12),
    getQuestionsForFlashGame: vi.fn().mockResolvedValue(mocks.TEST_QUESTIONS.slice(0, 10)),
    generateQuestionText: vi.fn((q: { questionData?: string }) => q.questionData ?? ''),
    getFlashDurationSeconds: vi.fn(() => 60),
  };
});

vi.mock('../services/leaderboard.service.js', () => ({
  updateLeaderboardScore: vi.fn(),
  updateSeasonLeaderboardScore: vi.fn(),
}));

vi.mock('../services/achievement.service.js', () => ({
  evaluateAchievementsAfterGame: vi.fn().mockResolvedValue([]),
  evaluateAchievementsAfterDaily: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/mastery.service.js', () => ({
  applyMasteryAttemptsForRun: vi.fn().mockResolvedValue(undefined),
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

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/game', gameRouter);
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, baseUrl };
}

function primeSession() {
  // Re-create test-session-1 with a clean state for each caller.
  // Also clear any stale SET-NX answer keys from prior tests.
  const prefix = 'game:answer:test-session-1:';
  for (const key of mocks.redisStore.keys()) {
    if (key.startsWith(prefix)) mocks.redisStore.delete(key);
  }
  const mechanicPrefix = 'game:mechanic:test-session-1:';
  for (const key of mocks.redisStore.keys()) {
    if (key.startsWith(mechanicPrefix)) mocks.redisStore.delete(key);
  }
  const correctAnswers: Record<string, string> = {};
  const optionsPerQuestion: Record<string, string[]> = {};
  for (const q of mocks.TEST_QUESTIONS) {
    correctAnswers[q.id] = q.correctAnswer;
    optionsPerQuestion[q.id] = [...q.options];
  }
  mocks.sessionStore.set('test-session-1', {
    sessionId: 'test-session-1',
    userId: 'user-1',
    gameMode: 'SINGLE',
    variant: 'CLASSIC',
    category: 'MIXED',
    questionIds: mocks.TEST_QUESTIONS.map((q: { id: string }) => q.id),
    correctAnswers,
    optionsPerQuestion,
    answeredQuestionIds: [],
    questionResults: {},
    mechanicsUsage: {},
    createdAt: Date.now(),
    expiresAt: Date.now() + 7200000,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /game/answer — session integrity', () => {
  it('rejects answer without sessionId → SESSION_REQUIRED', async () => {
    const { server, baseUrl } = startServer();
    try {
      const res = await fetch(`${baseUrl}/api/game/answer`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionId: 'q-1', answer: 'Correct', timeRemaining: 5, gameType: 'single' }),
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { code: string }).code).toBe('SESSION_REQUIRED');
    } finally { server.close(); }
  });

  it('rejects unknown sessionId → GAME_SESSION_EXPIRED', async () => {
    const { server, baseUrl } = startServer();
    try {
      const res = await fetch(`${baseUrl}/api/game/answer`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 'no-such', questionId: 'q-1', answer: 'Correct', timeRemaining: 5, gameType: 'single' }),
      });
      expect(res.status).toBe(410);
    } finally { server.close(); }
  });

  it('rejects question not in session → GAME_INVALID_QUESTION', async () => {
    const { server, baseUrl } = startServer();
    primeSession();
    try {
      const res = await fetch(`${baseUrl}/api/game/answer`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 'test-session-1', questionId: 'not-here', answer: 'X', timeRemaining: 5, gameType: 'single' }),
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { code: string }).code).toBe('GAME_INVALID_QUESTION');
    } finally { server.close(); }
  });

  it('blocks answer probing: re-answer returns stored result unchanged', async () => {
    const { server, baseUrl } = startServer();
    primeSession();
    try {
      const r1 = await fetch(`${baseUrl}/api/game/answer`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 'test-session-1', questionId: 'q-1', answer: 'Correct', timeRemaining: 5, gameType: 'single' }),
      });
      const b1 = await r1.json() as { isCorrect: boolean; points: number };
      expect(b1.isCorrect).toBe(true);

      // Try a different answer — must return stored, not re-validate
      const r2 = await fetch(`${baseUrl}/api/game/answer`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 'test-session-1', questionId: 'q-1', answer: 'Wrong1', timeRemaining: 5, gameType: 'single' }),
      });
      const b2 = await r2.json() as { isCorrect: boolean; points: number };
      expect(b2.isCorrect).toBe(true);
      expect(b2.points).toBe(b1.points);
    } finally { server.close(); }
  });
});

describe('POST /game/finish — session integrity', () => {
  it('rejects finish without sessionId (zod validation)', async () => {
    const { server, baseUrl } = startServer();
    try {
      const res = await fetch(`${baseUrl}/api/game/finish`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameType: 'single' }),
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { code: string }).code).toBe('VALIDATION_FAILED');
    } finally { server.close(); }
  });

  it('finish derives from session answers, ignores client body', async () => {
    const { server, baseUrl } = startServer();
    primeSession();
    try {
      // Answer 5 questions: first 3 correct, last 2 wrong
      for (let i = 1; i <= 5; i++) {
        await fetch(`${baseUrl}/api/game/answer`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId: 'test-session-1', questionId: `q-${i}`, answer: i <= 3 ? 'Correct' : 'Wrong', timeRemaining: 5, gameType: 'single' }),
        });
      }
      // Client body sends ALL wrong answers — server ignores them
      const res = await fetch(`${baseUrl}/api/game/finish`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'test-session-1',
          answers: mocks.TEST_QUESTIONS.map((q: { id: string }) => ({ questionId: q.id, answer: 'Wrong', timeRemaining: 5 })),
          gameType: 'single',
        }),
      });
      expect(res.status).toBe(200);
      const result = await res.json() as { correctCount: number; totalQuestions: number };
      expect(result.correctCount).toBe(3);
      expect(result.totalQuestions).toBe(5);
    } finally { server.close(); }
  });
});

describe('POST /game/mechanic — 50/50 server-side', () => {
  it('uses stored option order, never hides correct answer (index 0)', async () => {
    const { server, baseUrl } = startServer();
    primeSession();
    try {
      const res = await fetch(`${baseUrl}/api/game/mechanic`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 'test-session-1', questionId: 'q-1', mechanic: 'intel5050' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { hiddenOptionIndexes: number[] };
      expect(body.hiddenOptionIndexes).not.toContain(0);
      expect(body.hiddenOptionIndexes.length).toBe(2);
    } finally { server.close(); }
  });

  it('rejects mechanic when exhausted (1 use only)', async () => {
    const { server, baseUrl } = startServer();
    primeSession();
    try {
      await fetch(`${baseUrl}/api/game/mechanic`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 'test-session-1', questionId: 'q-1', mechanic: 'intel5050' }),
      });
      const res = await fetch(`${baseUrl}/api/game/mechanic`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 'test-session-1', questionId: 'q-2', mechanic: 'intel5050' }),
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { code: string }).code).toBe('MECHANIC_UNAVAILABLE');
    } finally { server.close(); }
  });

  it('rejects mechanic for PRACTICE session → MECHANIC_VARIANT_REJECTED', async () => {
    const { server, baseUrl } = startServer();
    const correctAnswers: Record<string, string> = {};
    const optionsPerQuestion: Record<string, string[]> = {};
    for (const q of mocks.TEST_QUESTIONS) {
      correctAnswers[q.id] = q.correctAnswer;
      optionsPerQuestion[q.id] = [...q.options];
    }
    mocks.sessionStore.set('practice-session', {
      sessionId: 'practice-session',
      userId: 'user-1',
      gameMode: 'SINGLE',
      variant: 'PRACTICE',
      category: 'MIXED',
      questionIds: mocks.TEST_QUESTIONS.map((q: { id: string }) => q.id),
      correctAnswers,
      optionsPerQuestion,
      answeredQuestionIds: [],
      questionResults: {},
      mechanicsUsage: {},
      createdAt: Date.now(),
      expiresAt: Date.now() + 7200000,
    });
    try {
      const res = await fetch(`${baseUrl}/api/game/mechanic`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 'practice-session', questionId: 'q-1', mechanic: 'intel5050' }),
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { code: string }).code).toBe('MECHANIC_VARIANT_REJECTED');
    } finally { server.close(); }
  });
});

describe('GET /game/daily — no correctAnswer leakage', () => {
  it('daily question payload has no correctAnswer, latitude, or longitude', async () => {
    const { server, baseUrl } = startServer();
    try {
      const res = await fetch(`${baseUrl}/api/game/daily`);
      expect(res.status).toBe(200);
      const body = await res.json() as { questions: Array<Record<string, unknown>> };
      expect(body.questions).toBeDefined();
      for (const q of body.questions) {
        expect(q).not.toHaveProperty('correctAnswer');
        expect(q).not.toHaveProperty('latitude');
        expect(q).not.toHaveProperty('longitude');
      }
    } finally { server.close(); }
  });
});

describe('POST /game/extend-session — streak refill', () => {
  it('extends session with new questions (no correctAnswer leaked)', async () => {
    const { server, baseUrl } = startServer();
    // Create a STREAK session
    const sessionStore = mocks.sessionStore;
    const streakSession = {
      sessionId: 'streak-session',
      userId: 'user-1',
      gameMode: 'SINGLE',
      variant: 'STREAK',
      category: 'CAPITAL',
      questionIds: mocks.TEST_QUESTIONS.map((q: { id: string }) => q.id),
      correctAnswers: Object.fromEntries(mocks.TEST_QUESTIONS.map((q: { id: string; correctAnswer: string }) => [q.id, q.correctAnswer])),
      optionsPerQuestion: Object.fromEntries(mocks.TEST_QUESTIONS.map((q: { id: string; options: string[] }) => [q.id, [...q.options]])),
      answeredQuestionIds: [],
      questionResults: {},
      mechanicsUsage: {},
      createdAt: Date.now(),
      expiresAt: Date.now() + 7200000,
    };
    sessionStore.set('streak-session', streakSession);
    try {
      const res = await fetch(`${baseUrl}/api/game/extend-session`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 'streak-session' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { questions: Array<Record<string, unknown>> };
      expect(body.questions.length).toBeGreaterThan(0);
      for (const q of body.questions) { expect(q).not.toHaveProperty('correctAnswer'); }
    } finally { server.close(); }
  });

  it('rejects Classic session (extend only for STREAK)', async () => {
    const { server, baseUrl } = startServer();
    primeSession();
    try {
      const res = await fetch(`${baseUrl}/api/game/extend-session`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 'test-session-1' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { code: string };
      expect(body.code).toBe('EXTEND_STREAK_ONLY');
    } finally { server.close(); }
  });
  it('rejects unknown session → 410', async () => {
    const { server, baseUrl } = startServer();
    try {
      const res = await fetch(`${baseUrl}/api/game/extend-session`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 'no-such' }),
      });
      expect(res.status).toBe(410);
    } finally { server.close(); }
  });
});
