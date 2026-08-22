import express from 'express';
import { AddressInfo } from 'node:net';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Category, Difficulty, GameVariant, WorldEventBossAttemptStatus, type WorldEventRegion } from '@prisma/client';
import worldEventRouter from '../controllers/worldEvent.controller.js';
import { evaluateAchievementsAfterBoss, evaluateAchievementsAfterGame } from '../services/achievement.service.js';
import { trackServerEvent } from '../services/telemetry.service.js';
import { getCurrentWorldEvent, BOSS_TOTAL_QUESTIONS } from '../services/worldEvent.service.js';

// ─── Fixture: current event is date-independent ───────────────────────
const CURRENT = getCurrentWorldEvent();
const CURRENT_EVENT_ID = CURRENT.eventId;
const CURRENT_REGION = CURRENT.region;
const REGION_CONTINENT: Record<string, string> = {
  AFRICA: 'Africa',
  AMERICAS: 'North America',
  ASIA: 'Asia',
  EUROPE: 'Europe',
  OCEANIA: 'Oceania',
};
const OTHER_REGION: WorldEventRegion = CURRENT_REGION === 'AFRICA' ? 'EUROPE' : 'AFRICA';
const OTHER_CONTINENT = REGION_CONTINENT[OTHER_REGION];

const REGION_CODES = Array.from({ length: 10 }, (_, i) => `${CURRENT_REGION.slice(0, 2)}${String(i).padStart(2, '0')}`);
const OTHER_CODES = Array.from({ length: 5 }, (_, i) => `${OTHER_REGION.slice(0, 2)}${String(i).padStart(2, '0')}`);

const BOSS_CATEGORIES = [Category.FLAG, Category.CAPITAL, Category.SILHOUETTE, Category.MONUMENT];

// ─── Mocks ────────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  masteryAttemptFindMany: vi.fn(),
  questionFindMany: vi.fn(),
  questionFindUnique: vi.fn(),
  gameResultFindFirst: vi.fn(),
  gameResultFindUnique: vi.fn(),
  gameResultCreate: vi.fn(),
  planFindUnique: vi.fn(),
  planCreate: vi.fn(),
  attemptFindMany: vi.fn(),
  attemptFindFirst: vi.fn(),
  attemptFindUnique: vi.fn(),
  attemptCreate: vi.fn(),
  attemptUpdate: vi.fn(),
  answerFindFirst: vi.fn(),
  answerCreate: vi.fn(),
  userUpdate: vi.fn(),
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),

  state: {
    plans: [] as any[],
    attempts: [] as any[],
    answers: [] as any[],
    gameResults: [] as any[],
    gamesPlayed: 0,
    attemptSeq: 0,
    answerSeq: 0,
  },
  lockChain: Promise.resolve(),
}));

const s = mocks.state;

vi.mock('../middleware/auth.js', () => ({
  authenticateJWT: (req: { user?: { userId: string } }, _res: unknown, next: () => void) => {
    req.user = { userId: 'user-1' };
    next();
  },
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../config/database.js', () => {
  const prisma = {
    masteryAttempt: { findMany: mocks.masteryAttemptFindMany },
    question: { findMany: mocks.questionFindMany, findUnique: mocks.questionFindUnique },
    gameResult: {
      findFirst: mocks.gameResultFindFirst,
      findUnique: mocks.gameResultFindUnique,
      create: mocks.gameResultCreate,
    },
    worldEventPlan: { findUnique: mocks.planFindUnique, create: mocks.planCreate },
    worldEventBossAttempt: {
      findMany: mocks.attemptFindMany,
      findFirst: mocks.attemptFindFirst,
      findUnique: mocks.attemptFindUnique,
      create: mocks.attemptCreate,
      update: mocks.attemptUpdate,
    },
    worldEventBossAnswer: {
      findFirst: mocks.answerFindFirst,
      create: mocks.answerCreate,
    },
    user: { update: mocks.userUpdate },
    $transaction: mocks.$transaction,
    $queryRaw: mocks.$queryRaw,
  };
  return { prisma };
});

vi.mock('../services/achievement.service.js', () => ({
  evaluateAchievementsAfterBoss: vi.fn().mockResolvedValue([]),
  evaluateAchievementsAfterGame: vi.fn().mockResolvedValue([]),
  getUserAchievements: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/telemetry.service.js', () => ({
  trackServerEvent: vi.fn(),
}));

// ─── In-memory DB simulation ──────────────────────────────────────────
interface AttemptFixture {
  id: string;
  eventId: string;
  userId: string;
  status: WorldEventBossAttemptStatus;
  currentQuestionIndex: number;
  correctCount: number;
  score: number;
  questionStartedAt: Date | null;
  startedAt: Date;
  expiresAt: Date;
  finishedAt: Date | null;
}

function makeAttempt(overrides: Partial<AttemptFixture> = {}): AttemptFixture {
  return {
    id: 'attempt-1',
    eventId: CURRENT_EVENT_ID,
    userId: 'user-1',
    status: WorldEventBossAttemptStatus.ACTIVE,
    currentQuestionIndex: 0,
    correctCount: 0,
    score: 0,
    questionStartedAt: new Date(),
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    finishedAt: null,
    ...overrides,
  };
}

function makePlan(questionIds: string[] = Array.from({ length: BOSS_TOTAL_QUESTIONS }, (_, i) => `q${i}`)) {
  return {
    eventId: CURRENT_EVENT_ID,
    version: 'weekly-world-event-v1',
    region: CURRENT_REGION,
    questionIds,
    stops: questionIds.map((questionId, i) => ({
      questionId,
      countryCode: REGION_CODES[i % REGION_CODES.length],
      category: BOSS_CATEGORIES[i % BOSS_CATEGORIES.length],
      difficulty: Difficulty.MEDIUM,
    })),
    startsAt: new Date(`${CURRENT_EVENT_ID}T00:00:00.000Z`),
    endsAt: new Date(`${CURRENT_EVENT_ID}T07:00:00.000Z`),
  };
}

function wireInMemoryDb() {
  const s = mocks.state;

  mocks.masteryAttemptFindMany.mockResolvedValue(
    REGION_CODES.map((cc, i) => ({
      countryCode: cc,
      category: BOSS_CATEGORIES[i % BOSS_CATEGORIES.length],
    })).concat(
      OTHER_CODES.map((cc) => ({ countryCode: cc, category: Category.FLAG })),
    ),
  );

  mocks.questionFindMany.mockImplementation(async (args: any) => {
    if (args?.select?.id) {
      // composer shape: return a realistic pool covering all regions
      const pool: any[] = [];
      const regions = ['Africa', 'Asia', 'Europe', 'Oceania', 'North America', 'South America'];
      const difficulties = [Difficulty.MEDIUM, Difficulty.HARD, Difficulty.EASY];
      let n = 0;
      for (const continent of regions) {
        for (let c = 0; c < 25; c++) {
          const cc = `${continent.slice(0, 2)}${String(c).padStart(2, '0')}`;
          for (let q = 0; q < 3; q++) {
            pool.push({
              id: `pool-${n++}`,
              category: BOSS_CATEGORIES[(c + q) % BOSS_CATEGORIES.length],
              countryCode: cc,
              continent,
              difficulty: difficulties[(c + q) % difficulties.length],
            });
          }
        }
      }
      const catFilter = args.where?.category?.in as Category[] | undefined;
      return catFilter ? pool.filter((q) => catFilter.includes(q.category)) : pool;
    }
    // progress shape: map countryCode -> continent
    const codes: string[] = args.where.countryCode.in ?? [];
    return codes.map((cc) => {
      if (REGION_CODES.includes(cc)) return { countryCode: cc, continent: REGION_CONTINENT[CURRENT_REGION] };
      if (OTHER_CODES.includes(cc)) return { countryCode: cc, continent: OTHER_CONTINENT };
      return { countryCode: cc, continent: null };
    });
  });

  mocks.gameResultFindFirst.mockResolvedValue({ id: 'daily-1' });

  mocks.planFindUnique.mockImplementation(async (args: { where: { eventId: string } }) => {
    return s.plans.find((p) => p.eventId === args.where.eventId) ?? null;
  });
  mocks.planCreate.mockImplementation(async (args: any) => {
    s.plans.push({ id: args.data.eventId, ...args.data });
    return s.plans[s.plans.length - 1];
  });

  mocks.attemptFindMany.mockImplementation(async (args: any) => {
    return s.attempts.filter((a) =>
      Object.entries(args.where ?? {}).every(([k, v]) => {
        if (k === 'status') return a.status === v;
        return a[k] === v;
      }),
    );
  });
  mocks.attemptFindFirst.mockImplementation(async (args: any) => {
    return (
      s.attempts.find((a) =>
        Object.entries(args.where ?? {}).every(([k, v]) => {
          if (k === 'status') return a.status === v;
          return a[k] === v;
        }),
      ) ?? null
    );
  });
  mocks.attemptFindUnique.mockImplementation(async (args: { where: { id: string } }) => {
    return s.attempts.find((a) => a.id === args.where.id) ?? null;
  });
  mocks.attemptCreate.mockImplementation(async (args: any) => {
    const attempt = { id: `attempt-${++s.attemptSeq}`, ...args.data };
    s.attempts.push(attempt);
    return attempt;
  });
  mocks.attemptUpdate.mockImplementation(async (args: any) => {
    const a = s.attempts.find((item) => item.id === args.where.id);
    if (a) Object.assign(a, args.data);
    return a;
  });

  mocks.answerFindFirst.mockImplementation(async (args: any) => {
    return (
      s.answers.find(
        (a) => a.attemptId === args.where.attemptId && a.questionId === args.where.questionId,
      ) ?? null
    );
  });
  mocks.answerCreate.mockImplementation(async (args: any) => {
    const dup =
      s.answers.find(
        (a) =>
          a.attemptId === args.data.attemptId &&
          (a.questionIndex === args.data.questionIndex || a.questionId === args.data.questionId),
      ) ?? null;
    if (dup) {
      const err = new Error('Unique constraint') as any;
      err.code = 'P2002';
      throw err;
    }
    const answer = { id: `answer-${++s.answerSeq}`, ...args.data };
    s.answers.push(answer);
    return answer;
  });

  mocks.gameResultFindUnique.mockImplementation(async (args: { where: { runId: string } }) => {
    return s.gameResults.find((g) => g.runId === args.where.runId) ?? null;
  });
  mocks.gameResultCreate.mockImplementation(async (args: any) => {
    const g = { id: `game-${s.gameResults.length + 1}`, ...args.data };
    s.gameResults.push(g);
    return g;
  });
  mocks.userUpdate.mockImplementation(async (args: any) => {
    s.gamesPlayed += args.data.gamesPlayed?.increment ?? 0;
    return { id: 'user-1' };
  });

  mocks.questionFindUnique.mockImplementation(async (args: { where: { id: string } }) => {
    const id = args.where.id;
    return {
      id,
      category: BOSS_CATEGORIES[Number(id.replace(/\D/g, '')) % BOSS_CATEGORIES.length] ?? Category.FLAG,
      questionData: `Pais ${id}`,
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      imageUrl: null,
      difficulty: Difficulty.MEDIUM,
    };
  });

  mocks.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
    const releases: Array<() => void> = [];
    const tx = {
      masteryAttempt: { findMany: mocks.masteryAttemptFindMany },
      question: { findMany: mocks.questionFindMany, findUnique: mocks.questionFindUnique },
      gameResult: {
        findFirst: mocks.gameResultFindFirst,
        findUnique: mocks.gameResultFindUnique,
        create: mocks.gameResultCreate,
      },
      worldEventPlan: { findUnique: mocks.planFindUnique, create: mocks.planCreate },
      worldEventBossAttempt: {
        findMany: mocks.attemptFindMany,
        findFirst: mocks.attemptFindFirst,
        findUnique: mocks.attemptFindUnique,
        create: mocks.attemptCreate,
        update: mocks.attemptUpdate,
      },
      worldEventBossAnswer: { findFirst: mocks.answerFindFirst, create: mocks.answerCreate },
      user: { update: mocks.userUpdate },
      $queryRaw: async (q: { values?: unknown[] }) => {
        const key = String(q.values?.[0] ?? '');
        const prev = mocks.lockChain;
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        mocks.lockChain = prev.then(() => gate);
        await prev;
        releases.push(release);
      },
    };
    try {
      return await fn(tx);
    } finally {
      for (const r of releases.reverse()) r();
    }
  });
}

// ─── Server helper ────────────────────────────────────────────────────
function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/events', worldEventRouter);
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, baseUrl };
}

const resetState = () => {
  s.plans = [];
  s.attempts = [];
  s.answers = [];
  s.gameResults = [];
  s.gamesPlayed = 0;
  s.attemptSeq = 0;
  s.answerSeq = 0;
  mocks.lockChain = Promise.resolve();
};

describe('World Event controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
    wireInMemoryDb();
    s.attempts.push(makeAttempt());
    s.plans.push(makePlan());
    vi.mocked(evaluateAchievementsAfterBoss).mockResolvedValue([]);
    vi.mocked(evaluateAchievementsAfterGame).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetState();
  });

  describe('GET /api/events/current', () => {
    it('returns real computed progress and does NOT create a plan', async () => {
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/current`);
      const body = (await res.json()) as any;
      server.close();

      expect(res.status).toBe(200);
      expect(mocks.planCreate).not.toHaveBeenCalled();
      expect(body.progress.bossUnlocked).toBe(true);
      expect(body.progress.correctInRegion).toBe(10);
      expect(body.boss.unlocked).toBe(true);
      expect(body.event.eventId).toBe(CURRENT_EVENT_ID);
    });

    it('reflects real locked state when requirements are missing', async () => {
      mocks.masteryAttemptFindMany.mockResolvedValue([]);
      mocks.gameResultFindFirst.mockResolvedValue(null);
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/current`);
      const body = (await res.json()) as any;
      server.close();

      expect(body.progress.bossUnlocked).toBe(false);
      expect(body.boss.unlocked).toBe(false);
      expect(mocks.planCreate).not.toHaveBeenCalled();
    });

    it('reports cleared/best score from COMPLETED attempts', async () => {
      s.attempts = [
        makeAttempt({ status: WorldEventBossAttemptStatus.COMPLETED, correctCount: 8, score: 700 }),
        makeAttempt({ status: WorldEventBossAttemptStatus.COMPLETED, correctCount: 5, score: 400 }),
      ];
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/current`);
      const body = (await res.json()) as any;
      server.close();

      expect(body.boss.cleared).toBe(true);
      expect(body.boss.attempts).toBe(2);
      expect(body.boss.bestCorrect).toBe(8);
      expect(body.boss.bestScore).toBe(700);
    });
  });

  describe('POST /api/events/current/boss/start', () => {
    it('returns 403 EVENT_BOSS_LOCKED when not unlocked', async () => {
      mocks.masteryAttemptFindMany.mockResolvedValue([]);
      mocks.gameResultFindFirst.mockResolvedValue(null);
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/current/boss/start`, { method: 'POST' });
      const body = (await res.json()) as any;
      server.close();

      expect(res.status).toBe(403);
      expect(body.code).toBe('EVENT_BOSS_LOCKED');
      expect(mocks.planCreate).not.toHaveBeenCalled();
      expect(mocks.attemptCreate).not.toHaveBeenCalled();
    });

    it('starts a new attempt with a safe public question', async () => {
      s.attempts = [];
      s.plans = [];
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/current/boss/start`, { method: 'POST' });
      const body = (await res.json()) as any;
      server.close();

      expect(res.status).toBe(200);
      expect(body.resumed).toBe(false);
      expect(body.questionIndex).toBe(0);
      expect(body.correctCount).toBe(0);
      expect(body.score).toBe(0);
      expect(body.question.correctAnswer).toBeUndefined();
      expect(body.question.countryCode).toBeUndefined();
      expect(mocks.planCreate).toHaveBeenCalledTimes(1);
      expect(mocks.attemptCreate).toHaveBeenCalledTimes(1);
    });

    it('resumes an existing ACTIVE attempt without creating a new one', async () => {
      s.attempts = [makeAttempt({ id: 'existing-active', currentQuestionIndex: 4, correctCount: 3, score: 300 })];
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/current/boss/start`, { method: 'POST' });
      const body = (await res.json()) as any;
      server.close();

      expect(res.status).toBe(200);
      expect(body.resumed).toBe(true);
      expect(body.attemptId).toBe('existing-active');
      expect(body.questionIndex).toBe(4);
      expect(body.correctCount).toBe(3);
      expect(body.score).toBe(300);
      expect(mocks.attemptCreate).not.toHaveBeenCalled();
    });

    it('abandons an expired ACTIVE attempt and creates a fresh one', async () => {
      s.attempts = [makeAttempt({ id: 'expired', expiresAt: new Date(Date.now() - 1000) })];
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/current/boss/start`, { method: 'POST' });
      const body = (await res.json()) as any;
      server.close();

      expect(res.status).toBe(200);
      expect(body.attemptId).not.toBe('expired');
      expect(body.resumed).toBe(false);
      const expired = s.attempts.find((a) => a.id === 'expired');
      expect(expired.status).toBe(WorldEventBossAttemptStatus.ABANDONED);
    });

    it('concurrent starts create exactly one ACTIVE attempt and both reference it', async () => {
      s.attempts = [];
      const { server, baseUrl } = startServer();

      const [r1, r2] = await Promise.all([
        fetch(`${baseUrl}/api/events/current/boss/start`, { method: 'POST' }),
        fetch(`${baseUrl}/api/events/current/boss/start`, { method: 'POST' }),
      ]);
      const b1 = (await r1.json()) as any;
      const b2 = (await r2.json()) as any;
      server.close();

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(b1.attemptId).toBe(b2.attemptId);
      const activeCount = s.attempts.filter((a) => a.status === WorldEventBossAttemptStatus.ACTIVE).length;
      expect(activeCount).toBe(1);
      expect(s.attempts.length).toBe(1);
    });

    it('returns 503 EVENT_BOSS_POOL_INSUFFICIENT when the boss pool cannot compose, creating no attempt', async () => {
      s.attempts = [];
      s.plans = [];
      // Composer pool query (select.id present) returns an empty pool → boss
      // cannot be built. Progress query still maps region codes.
      mocks.questionFindMany.mockImplementation(async (args: any) => {
        if (args?.select?.id) return [];
        const codes: string[] = args.where.countryCode.in ?? [];
        return codes.map((cc) => ({
          countryCode: cc,
          continent: REGION_CONTINENT[CURRENT_REGION],
        }));
      });

      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/current/boss/start`, { method: 'POST' });
      const body = (await res.json()) as any;
      server.close();

      expect(res.status).toBe(503);
      expect(body.code).toBe('EVENT_BOSS_POOL_INSUFFICIENT');
      expect(body.error).toBe('No hay suficientes preguntas para generar el Guardián');
      expect(mocks.attemptCreate).not.toHaveBeenCalled();
      expect(mocks.planCreate).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/events/boss/:attemptId/answer', () => {
    const planQuestions = () => s.plans[0].questionIds;

    async function answer(qIndex: number, answer: string) {
      const attempt = s.attempts.find((a) => a.status === WorldEventBossAttemptStatus.ACTIVE) ?? s.attempts[0];
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/boss/${attempt.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: planQuestions()[qIndex], answer }),
      });
      const body = (await res.json()) as any;
      server.close();
      return { res, body };
    }

    it('rejects non-owned attempts', async () => {
      s.attempts = [makeAttempt({ id: 'other-user', userId: 'someone-else' })];
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/boss/other-user/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: planQuestions()[0], answer: 'A' }),
      });
      const body = (await res.json()) as any;
      server.close();

      expect(res.status).toBe(403);
      expect(body.code).toBe('BOSS_UNAUTHORIZED');
    });

    it('only accepts the expected question', async () => {
      s.attempts = [makeAttempt({ id: 'a1', currentQuestionIndex: 0 })];
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/boss/a1/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: planQuestions()[5], answer: 'A' }),
      });
      const body = (await res.json()) as any;
      server.close();

      expect(res.status).toBe(400);
      expect(body.code).toBe('BOSS_UNEXPECTED_QUESTION');
    });

    it('scores a correct answer (+100) and advances the index once', async () => {
      s.attempts = [makeAttempt({ id: 'a1', currentQuestionIndex: 0 })];
      const { res, body } = await answer(0, 'A');
      expect(res.status).toBe(200);
      expect(body.isCorrect).toBe(true);
      expect(body.points).toBe(100);
      expect(body.nextQuestionIndex).toBe(1);
      expect(body.correctCount).toBe(1);
      expect(body.score).toBe(100);
      const attempt = s.attempts.find((a) => a.id === 'a1')!;
      expect(attempt.currentQuestionIndex).toBe(1);
      expect(s.answers).toHaveLength(1);
    });

    it('scores a wrong answer as 0 and still advances', async () => {
      s.attempts = [makeAttempt({ id: 'a1', currentQuestionIndex: 0 })];
      const { res, body } = await answer(0, 'Z');
      expect(res.status).toBe(200);
      expect(body.isCorrect).toBe(false);
      expect(body.points).toBe(0);
      expect(body.nextQuestionIndex).toBe(1);
      expect(body.correctCount).toBe(0);
    });

    it('forces server-side timeout as incorrect regardless of client timing', async () => {
      s.attempts = [makeAttempt({
        id: 'a1',
        currentQuestionIndex: 0,
        questionStartedAt: new Date(Date.now() - 30 * 1000), // way past 20s + grace
      })];
      const { res, body } = await answer(0, 'A');
      expect(res.status).toBe(200);
      expect(body.isCorrect).toBe(false);
      expect(body.points).toBe(0);
    });

    it('sequential duplicate of q1 returns the same result without double-scoring', async () => {
      s.attempts = [makeAttempt({ id: 'a1', currentQuestionIndex: 0 })];
      const first = await answer(0, 'A');
      const second = await answer(0, 'A');

      expect(first.body.correctCount).toBe(1);
      expect(first.body.score).toBe(100);
      expect(second.body.isCorrect).toBe(true);
      expect(second.body.correctCount).toBe(1);
      expect(second.body.score).toBe(100);
      expect(second.body.nextQuestionIndex).toBe(1);
      expect(s.answers).toHaveLength(1);
      const attempt = s.attempts.find((a) => a.id === 'a1')!;
      expect(attempt.currentQuestionIndex).toBe(1);
      expect(attempt.correctCount).toBe(1);
    });

    it('concurrent duplicate of q1: exactly 1 answer, index +1 once, score once', async () => {
      s.attempts = [makeAttempt({ id: 'a1', currentQuestionIndex: 0 })];
      const attempt = s.attempts[0];
      const payload = { questionId: planQuestions()[0], answer: 'A' };

      const { server, baseUrl } = startServer();
      const [r1, r2] = await Promise.all([
        fetch(`${baseUrl}/api/events/boss/a1/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        fetch(`${baseUrl}/api/events/boss/a1/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      ]);
      const b1 = (await r1.json()) as any;
      const b2 = (await r2.json()) as any;
      server.close();

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(b1.correctCount).toBe(b2.correctCount);
      expect(b1.score).toBe(b2.score);
      expect(s.answers).toHaveLength(1);
      expect(attempt.currentQuestionIndex).toBe(1);
      expect(attempt.correctCount).toBe(1);
      expect(attempt.score).toBe(100);
    });

    it('finishes on the 10th answer: exactly 1 GameResult, gamesPlayed +1 once', async () => {
      // Seed 9 answered questions + attempt at index 9 with 8 correct (clear threshold met at 9 if +1)
      s.answers = [];
      for (let i = 0; i < 9; i++) {
        s.answers.push({
          id: `answer-${i}`,
          attemptId: 'a1',
          questionId: planQuestions()[i],
          questionIndex: i,
          userAnswer: 'A',
          isCorrect: true,
          points: 100,
        });
      }
      s.attempts = [makeAttempt({
        id: 'a1',
        currentQuestionIndex: 9,
        correctCount: 8,
        score: 800,
        status: WorldEventBossAttemptStatus.ACTIVE,
      })];

      const { res, body } = await answer(9, 'A');
      expect(res.status).toBe(200);
      expect(body.isFinal).toBe(true);
      expect(body.cleared).toBe(true);
      expect(s.gameResults).toHaveLength(1);
      expect(s.gameResults[0].runId).toBe('event-boss:a1');
      expect(s.gameResults[0].variant).toBe(GameVariant.EVENT_BOSS);
      expect(s.gameResults[0].correctCount).toBe(9);
      expect(s.gamesPlayed).toBe(1);
      const attempt = s.attempts.find((a) => a.id === 'a1')!;
      expect(attempt.status).toBe(WorldEventBossAttemptStatus.COMPLETED);
      expect(attempt.finishedAt).not.toBeNull();
      expect(attempt.currentQuestionIndex).toBe(BOSS_TOTAL_QUESTIONS);
    });

    it('retry of the final question after COMPLETED returns canonical finished response without side effects', async () => {
      s.answers = [];
      for (let i = 0; i < BOSS_TOTAL_QUESTIONS; i++) {
        s.answers.push({
          id: `answer-${i}`,
          attemptId: 'a1',
          questionId: planQuestions()[i],
          questionIndex: i,
          userAnswer: 'A',
          isCorrect: true,
          points: 100,
        });
      }
      s.attempts = [makeAttempt({
        id: 'a1',
        currentQuestionIndex: BOSS_TOTAL_QUESTIONS,
        correctCount: BOSS_TOTAL_QUESTIONS,
        score: 1000,
        status: WorldEventBossAttemptStatus.COMPLETED,
        finishedAt: new Date(),
      })];
      s.gameResults = [{
        id: 'game-1',
        runId: 'event-boss:a1',
        userId: 'user-1',
        correctCount: BOSS_TOTAL_QUESTIONS,
        score: 1000,
      }];
      s.gamesPlayed = 1;

      const { res, body } = await answer(BOSS_TOTAL_QUESTIONS - 1, 'A');
      expect(res.status).toBe(200);
      expect(body.isFinal).toBe(true);
      expect(body.cleared).toBe(true);
      expect(body.correctCount).toBe(BOSS_TOTAL_QUESTIONS);
      expect(s.gameResults).toHaveLength(1);
      expect(s.gamesPlayed).toBe(1);
      expect(s.answers).toHaveLength(BOSS_TOTAL_QUESTIONS);
    });

    it('transaction rollback is atomic: answer failure leaves attempt untouched', async () => {
      s.attempts = [makeAttempt({ id: 'a1', currentQuestionIndex: 0 })];
      // Simulate a failure in the answer create (network/constraint) — controller must 500 but attempt unchanged
      mocks.answerCreate.mockRejectedValueOnce(new Error('db down'));
      const { res } = await answer(0, 'A');
      expect(res.status).toBe(500);
      const attempt = s.attempts.find((a) => a.id === 'a1')!;
      expect(attempt.currentQuestionIndex).toBe(0);
      expect(attempt.correctCount).toBe(0);
      expect(s.answers).toHaveLength(0);
    });

    it('final answer runs idempotent boss + game achievements', async () => {
      s.answers = [];
      for (let i = 0; i < 9; i++) {
        s.answers.push({
          id: `answer-${i}`,
          attemptId: 'a1',
          questionId: planQuestions()[i],
          questionIndex: i,
          userAnswer: 'A',
          isCorrect: true,
          points: 100,
        });
      }
      s.attempts = [makeAttempt({
        id: 'a1',
        currentQuestionIndex: 9,
        correctCount: 9,
        score: 900,
      })];

      const { res } = await answer(9, 'A');
      expect(res.status).toBe(200);
      expect(evaluateAchievementsAfterBoss).toHaveBeenCalledWith('user-1', 10);
      expect(evaluateAchievementsAfterGame).toHaveBeenCalledWith({
        userId: 'user-1',
        correctCount: 10,
        totalQuestions: BOSS_TOTAL_QUESTIONS,
        score: 1000,
      });
    });
  });

  describe('Boss telemetry — server-owned', () => {
    it('emits exactly one game_started for a new boss run', async () => {
      s.attempts = [];
      s.plans = [];
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/current/boss/start`, { method: 'POST' });
      server.close();
      expect(res.status).toBe(200);
      const started = vi.mocked(trackServerEvent).mock.calls.filter((c) => c[0].name === 'game_started');
      expect(started).toHaveLength(1);
    });

    it('does not emit game_started on resume', async () => {
      s.attempts = [makeAttempt({ id: 'existing-active', currentQuestionIndex: 4, correctCount: 3, score: 300 })];
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/current/boss/start`, { method: 'POST' });
      const body = (await res.json()) as any;
      server.close();
      expect(res.status).toBe(200);
      expect(body.resumed).toBe(true);
      const started = vi.mocked(trackServerEvent).mock.calls.filter((c) => c[0].name === 'game_started');
      expect(started).toHaveLength(0);
    });

    it('emits question_answered on answer', async () => {
      s.attempts = [makeAttempt({ id: 'a1', currentQuestionIndex: 0 })];
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/boss/a1/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: s.plans[0].questionIds[0], answer: 'A' }),
      });
      server.close();
      expect(res.status).toBe(200);
      const answered = vi.mocked(trackServerEvent).mock.calls.filter((c) => c[0].name === 'question_answered');
      expect(answered).toHaveLength(1);
    });

    it('emits game_finished on the final answer', async () => {
      s.answers = [];
      for (let i = 0; i < 9; i++) {
        s.answers.push({
          id: `answer-${i}`,
          attemptId: 'a1',
          questionId: s.plans[0].questionIds[i],
          questionIndex: i,
          userAnswer: 'A',
          isCorrect: true,
          points: 100,
        });
      }
      s.attempts = [makeAttempt({ id: 'a1', currentQuestionIndex: 9, correctCount: 9, score: 900 })];
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/boss/a1/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: s.plans[0].questionIds[9], answer: 'A' }),
      });
      server.close();
      expect(res.status).toBe(200);
      const finished = vi.mocked(trackServerEvent).mock.calls.filter((c) => c[0].name === 'game_finished');
      expect(finished).toHaveLength(1);
    });
  });

  describe('Boss timer — authoritative handoff', () => {
    it('first question is served with ~20s remaining', async () => {
      s.attempts = [];
      s.plans = [];
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/current/boss/start`, { method: 'POST' });
      const body = (await res.json()) as any;
      server.close();
      expect(res.status).toBe(200);
      expect(body.timeRemainingMs).toBeGreaterThan(19000);
      expect(body.timeRemainingMs).toBeLessThanOrEqual(20000);
    });

    it('resume after ~8s elapsed returns ~12s remaining, never a full reset', async () => {
      s.attempts = [makeAttempt({
        id: 'existing-active',
        currentQuestionIndex: 2,
        questionStartedAt: new Date(Date.now() - 8000),
      })];
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/current/boss/start`, { method: 'POST' });
      const body = (await res.json()) as any;
      server.close();
      expect(body.resumed).toBe(true);
      expect(body.timeRemainingMs).toBeGreaterThan(11000);
      expect(body.timeRemainingMs).toBeLessThan(13000);
    });

    it('repeated start/resume does not reset questionStartedAt', async () => {
      const startedAt = new Date(Date.now() - 8000);
      s.attempts = [makeAttempt({
        id: 'existing-active',
        currentQuestionIndex: 2,
        questionStartedAt: startedAt,
      })];
      const { server, baseUrl } = startServer();
      const r1 = await fetch(`${baseUrl}/api/events/current/boss/start`, { method: 'POST' });
      const b1 = (await r1.json()) as any;
      const r2 = await fetch(`${baseUrl}/api/events/current/boss/start`, { method: 'POST' });
      const b2 = (await r2.json()) as any;
      server.close();
      expect(b1.timeRemainingMs).toBeGreaterThan(11000);
      expect(b2.timeRemainingMs).toBeGreaterThan(11000);
      expect(Math.abs(b1.timeRemainingMs - b2.timeRemainingMs)).toBeLessThan(1000);
      const attempt = s.attempts.find((a) => a.id === 'existing-active')!;
      expect(attempt.questionStartedAt.getTime()).toBe(startedAt.getTime());
    });

    it('after a non-final answer the next question is served with a fresh ~20s clock', async () => {
      s.attempts = [makeAttempt({
        id: 'a1',
        currentQuestionIndex: 0,
        questionStartedAt: new Date(Date.now() - 15000),
      })];
      const { server, baseUrl } = startServer();
      const ansRes = await fetch(`${baseUrl}/api/events/boss/a1/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: s.plans[0].questionIds[0], answer: 'A' }),
      });
      expect(ansRes.status).toBe(200);
      const attemptAfter = s.attempts.find((a) => a.id === 'a1')!;
      expect(attemptAfter.questionStartedAt).toBeNull();

      const res = await fetch(`${baseUrl}/api/events/current/boss/start`, { method: 'POST' });
      const body = (await res.json()) as any;
      server.close();
      expect(body.resumed).toBe(true);
      expect(body.questionIndex).toBe(1);
      expect(body.timeRemainingMs).toBeGreaterThan(19000);
    });

    it('expired question returns 0 remaining so the client fires a normal timeout', async () => {
      s.attempts = [makeAttempt({
        id: 'existing-active',
        currentQuestionIndex: 2,
        questionStartedAt: new Date(Date.now() - 30 * 1000),
      })];
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/current/boss/start`, { method: 'POST' });
      const body = (await res.json()) as any;
      server.close();
      expect(body.timeRemainingMs).toBe(0);
    });
  });

  describe('Integrity — no contamination', () => {
    it('final run never touches MasteryAttempt, CompetitiveRating, or highScore', async () => {
      s.answers = [];
      for (let i = 0; i < 9; i++) {
        s.answers.push({
          id: `answer-${i}`,
          attemptId: 'a1',
          questionId: s.plans[0].questionIds[i],
          questionIndex: i,
          userAnswer: 'A',
          isCorrect: true,
          points: 100,
        });
      }
      s.attempts = [makeAttempt({
        id: 'a1',
        currentQuestionIndex: 9,
        correctCount: 9,
        score: 900,
      })];

      const attempt = s.attempts[0];
      const { server, baseUrl } = startServer();
      const res = await fetch(`${baseUrl}/api/events/boss/${attempt.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: s.plans[0].questionIds[9], answer: 'A' }),
      });
      const body = (await res.json()) as any;
      server.close();

      expect(res.status).toBe(200);
      expect(body.cleared).toBe(true);
      // MasteryAttempt count unchanged (never queried/written)
      expect(mocks.masteryAttemptFindMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({}) }),
        expect.anything(),
      );
      // user.update was only used for gamesPlayed, never highScore
      for (const call of mocks.userUpdate.mock.calls) {
        expect(call[0].data.gamesPlayed).toBeDefined();
        expect(call[0].data.highScore).toBeUndefined();
      }
      expect(mocks.planCreate).toHaveBeenCalledTimes(0);
    });
  });
});
