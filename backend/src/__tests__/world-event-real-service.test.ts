import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Category, Difficulty, GameVariant, WorldEventRegion } from '@prisma/client';
import {
  getWorldEventProgress,
  getWorldEventWindow,
  getWorldEventWindowForId,
  buildBossFromPool,
  getOrCreateWorldEventPlan,
  BOSS_TOTAL_QUESTIONS,
  BOSS_HP_REQUIRED,
  WORLD_EVENT_VERSION,
  WORLD_EVENT_BOSS_VERSION,
  type BossPoolQuestion,
  type WorldEventPlanData,
} from '../services/worldEvent.service.js';

const mocks = vi.hoisted(() => ({
  masteryAttemptFindMany: vi.fn(),
  questionFindMany: vi.fn(),
  gameResultFindFirst: vi.fn(),
  worldEventPlanFindUnique: vi.fn(),
  worldEventPlanCreate: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock('../config/database.js', () => {
  const prisma = {
    masteryAttempt: { findMany: mocks.masteryAttemptFindMany },
    question: { findMany: mocks.questionFindMany },
    gameResult: { findFirst: mocks.gameResultFindFirst, findUnique: vi.fn() },
    worldEventPlan: {
      findUnique: mocks.worldEventPlanFindUnique,
      create: mocks.worldEventPlanCreate,
    },
    $transaction: mocks.$transaction,
  };
  return { prisma };
});

const EVENT_ID = '2026-08-10';
const EVENT_WINDOW = getWorldEventWindow(new Date(`${EVENT_ID}T12:00:00.000Z`));
const REGION: WorldEventRegion = 'AFRICA';

function makeRegionPool(): BossPoolQuestion[] {
  const pool: BossPoolQuestion[] = [];
  const regions: Array<{ region: WorldEventRegion; continent: string }> = [
    { region: 'AFRICA', continent: 'Africa' },
    { region: 'AMERICAS', continent: 'North America' },
    { region: 'AMERICAS', continent: 'South America' },
    { region: 'ASIA', continent: 'Asia' },
    { region: 'EUROPE', continent: 'Europe' },
    { region: 'OCEANIA', continent: 'Oceania' },
  ];
  const categories = [Category.FLAG, Category.CAPITAL, Category.SILHOUETTE, Category.MONUMENT, Category.CINEMA_GEO];
  const difficulties = [Difficulty.MEDIUM, Difficulty.HARD, Difficulty.EASY];

  for (const { region, continent } of regions) {
    for (let c = 0; c < 25; c++) {
      const cc = `${region.slice(0, 2)}${String(c).padStart(2, '0')}`;
      for (let q = 0; q < 3; q++) {
        pool.push({
          id: `${region}-q${c}-${q}`,
          category: categories[(c + q) % categories.length],
          countryCode: cc,
          continent,
          difficulty: difficulties[(c + q) % difficulties.length],
        });
      }
    }
  }
  return pool;
}

const REGION_COUNTRIES: Record<string, string> = {
  KE: 'Africa',
  NG: 'Africa',
  ZA: 'Africa',
  EG: 'Africa',
  FR: 'Europe',
  DE: 'Europe',
};

function baseAttempts(): Array<{ countryCode: string; category: Category }> {
  // 8 correct attempts in African countries across 3 categories
  return [
    { countryCode: 'KE', category: Category.FLAG },
    { countryCode: 'KE', category: Category.CAPITAL },
    { countryCode: 'NG', category: Category.FLAG },
    { countryCode: 'NG', category: Category.SILHOUETTE },
    { countryCode: 'ZA', category: Category.CAPITAL },
    { countryCode: 'ZA', category: Category.MONUMENT },
    { countryCode: 'EG', category: Category.SILHOUETTE },
    { countryCode: 'EG', category: Category.CINEMA_GEO },
  ];
}

function mockDefaultQuery(attempts: Array<{ countryCode: string; category: Category }> = baseAttempts()) {
  mocks.masteryAttemptFindMany.mockResolvedValue(attempts);
  mocks.questionFindMany.mockImplementation(async (args: any) => {
    const codes = args.where.countryCode.in as string[];
    return codes
      .filter((c) => REGION_COUNTRIES[c])
      .map((c) => ({ countryCode: c, continent: REGION_COUNTRIES[c] }));
  });
  mocks.gameResultFindFirst.mockResolvedValue({ id: 'daily-1' });
}

describe('World Event Service — real behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getWorldEventWindowForId', () => {
    it('derives a window that round-trips to the same eventId', () => {
      const w = getWorldEventWindowForId(EVENT_ID);
      expect(w.eventId).toBe(EVENT_ID);
      expect(w.startsAt.toISOString()).toBe('2026-08-10T00:00:00.000Z');
      expect(w.endsAt.toISOString()).toBe('2026-08-17T00:00:00.000Z');
    });

    it('rejects a non-Monday id', () => {
      expect(() => getWorldEventWindowForId('2026-08-15')).toThrow('INVALID_EVENT_ID');
    });
  });

  describe('getWorldEventProgress — no plan required', () => {
    it('computes real progress from MasteryAttempt + Daily, with NO plan lookup', async () => {
      mockDefaultQuery();
      mocks.worldEventPlanFindUnique.mockResolvedValue(null);

      const progress = await getWorldEventProgress('user-1', EVENT_ID, REGION);

      expect(mocks.worldEventPlanFindUnique).not.toHaveBeenCalled();
      expect(progress.correctInRegion).toBe(8);
      expect(progress.distinctCategories).toBe(5);
      expect(progress.dailyCompleted).toBe(true);
      expect(progress.bossUnlocked).toBe(true);
      expect(progress.correctRequired).toBe(8);
      expect(progress.categoriesRequired).toBe(3);
    });

    it('uses the event window in the MasteryAttempt and Daily queries', async () => {
      mockDefaultQuery([]);
      await getWorldEventProgress('user-1', EVENT_ID, REGION);

      const attemptCall = mocks.masteryAttemptFindMany.mock.calls[0][0];
      expect(attemptCall.where.occurredAt.gte).toEqual(EVENT_WINDOW.startsAt);
      expect(attemptCall.where.occurredAt.lt).toEqual(EVENT_WINDOW.endsAt);
      expect(attemptCall.where.isCorrect).toBe(true);

      const dailyCall = mocks.gameResultFindFirst.mock.calls[0][0];
      expect(dailyCall.where.variant).toBe(GameVariant.DAILY);
      expect(dailyCall.where.createdAt.gte).toEqual(EVENT_WINDOW.startsAt);
      expect(dailyCall.where.createdAt.lt).toEqual(EVENT_WINDOW.endsAt);
    });

    it('wrong attempts are ignored (isCorrect=false excluded at query level)', async () => {
      mockDefaultQuery([
        { countryCode: 'KE', category: Category.FLAG },
        { countryCode: 'KE', category: Category.CAPITAL },
      ]);
      const progress = await getWorldEventProgress('user-1', EVENT_ID, REGION);
      // findMany already filtered isCorrect=true; counted rows are all correct
      expect(progress.correctInRegion).toBe(2);
    });

    it('outside-window attempts are ignored (query filters by window)', async () => {
      mockDefaultQuery();
      await getWorldEventProgress('user-1', EVENT_ID, REGION);
      const call = mocks.masteryAttemptFindMany.mock.calls[0][0];
      expect(call.where.occurredAt).toBeDefined();
    });

    it('wrong region attempts are ignored', async () => {
      mocks.masteryAttemptFindMany.mockResolvedValue([
        { countryCode: 'KE', category: Category.FLAG },
        { countryCode: 'FR', category: Category.CAPITAL }, // Europe, not AFRICA
      ]);
      mocks.questionFindMany.mockImplementation(async (args: any) => {
        const codes = args.where.countryCode.in as string[];
        return codes
          .filter((c) => REGION_COUNTRIES[c])
          .map((c) => ({ countryCode: c, continent: REGION_COUNTRIES[c] }));
      });
      mocks.gameResultFindFirst.mockResolvedValue({ id: 'daily-1' });

      const progress = await getWorldEventProgress('user-1', EVENT_ID, REGION);
      expect(progress.correctInRegion).toBe(1);
    });

    it('MIXED category attempts are ignored', async () => {
      mocks.masteryAttemptFindMany.mockResolvedValue([
        { countryCode: 'KE', category: Category.FLAG },
        { countryCode: 'KE', category: Category.MIXED },
      ]);
      mocks.questionFindMany.mockImplementation(async (args: any) => {
        const codes = args.where.countryCode.in as string[];
        return codes
          .filter((c) => REGION_COUNTRIES[c])
          .map((c) => ({ countryCode: c, continent: REGION_COUNTRIES[c] }));
      });
      mocks.gameResultFindFirst.mockResolvedValue({ id: 'daily-1' });

      const progress = await getWorldEventProgress('user-1', EVENT_ID, REGION);
      expect(progress.correctInRegion).toBe(1);
      expect(progress.distinctCategories).toBe(1);
    });

    it('MAP correct attempts count toward preparation and distinct categories', async () => {
      mocks.masteryAttemptFindMany.mockResolvedValue([
        { countryCode: 'KE', category: Category.MAP },
        { countryCode: 'KE', category: Category.FLAG },
        { countryCode: 'KE', category: Category.MIXED },
      ]);
      mocks.questionFindMany.mockImplementation(async (args: any) => {
        const codes = args.where.countryCode.in as string[];
        return codes
          .filter((c) => REGION_COUNTRIES[c])
          .map((c) => ({ countryCode: c, continent: REGION_COUNTRIES[c] }));
      });
      mocks.gameResultFindFirst.mockResolvedValue({ id: 'daily-1' });

      const progress = await getWorldEventProgress('user-1', EVENT_ID, REGION);
      // MAP counts (+1) and is its own distinct category; MIXED still ignored
      expect(progress.correctInRegion).toBe(2);
      expect(progress.distinctCategories).toBe(2);
    });

    it('distinct categories are computed from counted attempts', async () => {
      mocks.masteryAttemptFindMany.mockResolvedValue([
        { countryCode: 'KE', category: Category.FLAG },
        { countryCode: 'KE', category: Category.FLAG },
        { countryCode: 'KE', category: Category.CAPITAL },
        { countryCode: 'KE', category: Category.SILHOUETTE },
      ]);
      mocks.questionFindMany.mockImplementation(async (args: any) => {
        const codes = args.where.countryCode.in as string[];
        return codes
          .filter((c) => REGION_COUNTRIES[c])
          .map((c) => ({ countryCode: c, continent: REGION_COUNTRIES[c] }));
      });
      mocks.gameResultFindFirst.mockResolvedValue({ id: 'daily-1' });

      const progress = await getWorldEventProgress('user-1', EVENT_ID, REGION);
      expect(progress.correctInRegion).toBe(4);
      expect(progress.distinctCategories).toBe(3);
    });

    it('Daily is required: without a DAILY GameResult the boss stays locked', async () => {
      mockDefaultQuery(baseAttempts());
      mocks.gameResultFindFirst.mockResolvedValue(null);

      const progress = await getWorldEventProgress('user-1', EVENT_ID, REGION);
      expect(progress.dailyCompleted).toBe(false);
      expect(progress.bossUnlocked).toBe(false);
    });

    it('needs all three requirements to unlock', async () => {
      // 8 correct, 3 categories, but no daily
      mockDefaultQuery([
        { countryCode: 'KE', category: Category.FLAG },
        { countryCode: 'KE', category: Category.CAPITAL },
        { countryCode: 'KE', category: Category.SILHOUETTE },
        { countryCode: 'KE', category: Category.MONUMENT },
        { countryCode: 'KE', category: Category.CINEMA_GEO },
        { countryCode: 'NG', category: Category.FLAG },
        { countryCode: 'NG', category: Category.CAPITAL },
        { countryCode: 'NG', category: Category.SILHOUETTE },
      ]);
      mocks.gameResultFindFirst.mockResolvedValue(null);
      let progress = await getWorldEventProgress('user-1', EVENT_ID, REGION);
      expect(progress.bossUnlocked).toBe(false);

      // with daily now
      mocks.gameResultFindFirst.mockResolvedValue({ id: 'daily-1' });
      progress = await getWorldEventProgress('user-1', EVENT_ID, REGION);
      expect(progress.bossUnlocked).toBe(true);
    });

    it('does not create any WorldEventPlan during progress/status', async () => {
      mockDefaultQuery();
      await getWorldEventProgress('user-1', EVENT_ID, REGION);
      expect(mocks.worldEventPlanCreate).not.toHaveBeenCalled();
    });
  });

  // ─── REAL COMPOSER ─────────────────────────────────────────────────
  describe('buildBossFromPool', () => {
    function validatePlan(plan: WorldEventPlanData, eventId: string, region: WorldEventRegion) {
      expect(plan.eventId).toBe(eventId);
      expect(plan.region).toBe(region);
      expect(plan.questionIds).toHaveLength(BOSS_TOTAL_QUESTIONS);
      expect(plan.stops).toHaveLength(BOSS_TOTAL_QUESTIONS);
      expect(new Set(plan.questionIds).size).toBe(BOSS_TOTAL_QUESTIONS);
      const countries = new Set(plan.stops.map((s) => s.countryCode));
      expect(countries.size).toBe(BOSS_TOTAL_QUESTIONS);
      const categories = new Set(plan.stops.map((s) => s.category));
      expect(categories.size).toBeGreaterThanOrEqual(3);
      const counts = new Map<Category, number>();
      for (const s of plan.stops) {
        counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
      }
      for (const [, count] of counts) {
        expect(count).toBeLessThanOrEqual(4);
      }
      // No MAP ever
      expect(plan.stops.every((s) => s.category !== Category.MAP)).toBe(true);
    }

    it('builds a valid 10-question boss with Tier 1 (MEDIUM/HARD)', () => {
      const pool = makeRegionPool();
      const { plan, tier } = buildBossFromPool(pool, EVENT_ID, REGION);
      expect(tier).toBe(1);
      validatePlan(plan, EVENT_ID, REGION);
      expect(plan.stops.every((s) => s.difficulty === Difficulty.MEDIUM || s.difficulty === Difficulty.HARD)).toBe(true);
    });

    it('falls back to Tier 2 when no MEDIUM/HARD exist', () => {
      const pool = makeRegionPool().map((q) => ({ ...q, difficulty: Difficulty.EASY }));
      const { plan, tier } = buildBossFromPool(pool, EVENT_ID, REGION);
      expect(tier).toBe(2);
      validatePlan(plan, EVENT_ID, REGION);
      expect(plan.stops.some((s) => s.difficulty === Difficulty.EASY)).toBe(true);
    });

    it('throws EVENT_BOSS_POOL_INSUFFICIENT for an impossible pool', () => {
      const tiny = makeRegionPool().slice(0, 6);
      expect(() => buildBossFromPool(tiny, EVENT_ID, REGION)).toThrow('EVENT_BOSS_POOL_INSUFFICIENT');
    });

    it('is deterministic for the same pool + event + region', () => {
      const pool = makeRegionPool();
      const a = buildBossFromPool(pool, EVENT_ID, REGION);
      const b = buildBossFromPool(pool, EVENT_ID, REGION);
      expect(a.plan.questionIds).toEqual(b.plan.questionIds);
    });

    it('produces different plans for different weeks', () => {
      const pool = makeRegionPool();
      const a = buildBossFromPool(pool, '2026-08-10', REGION);
      const b = buildBossFromPool(pool, '2026-08-17', 'AMERICAS');
      expect(a.plan.questionIds).not.toEqual(b.plan.questionIds);
    });
  });

  describe('260-week real composer simulation', () => {
    it('builds a valid boss for each of 260 consecutive events — 260/260', () => {
      const pool = makeRegionPool();
      let valid = 0;
      for (let i = 0; i < 260; i++) {
        const d = new Date('2026-08-10T12:00:00.000Z');
        d.setDate(d.getDate() + i * 7);
        const w = getWorldEventWindow(d);
        const { plan, tier } = buildBossFromPool(pool, w.eventId, w.region);

        expect(plan.questionIds).toHaveLength(BOSS_TOTAL_QUESTIONS);
        expect(new Set(plan.questionIds).size).toBe(BOSS_TOTAL_QUESTIONS);
        expect(new Set(plan.stops.map((s) => s.countryCode)).size).toBe(BOSS_TOTAL_QUESTIONS);
        expect(plan.region).toBe(w.region);
        expect(new Set(plan.stops.map((s) => s.category)).size).toBeGreaterThanOrEqual(3);
        const counts = new Map<Category, number>();
        for (const s of plan.stops) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
        for (const [, count] of counts) expect(count).toBeLessThanOrEqual(4);
        expect(plan.stops.every((s) => s.category !== Category.MAP)).toBe(true);
        expect(tier === 1 || tier === 2).toBe(true);
        valid++;
      }
      expect(valid).toBe(260);
    });
  });

  describe('getOrCreateWorldEventPlan — P2002 race', () => {
    it('returns the winner plan when create hits P2002', async () => {
      const winnerPlan = {
        eventId: EVENT_ID,
        version: WORLD_EVENT_VERSION,
        region: REGION,
        questionIds: ['w1', 'w2'],
        stops: [
          { questionId: 'w1', countryCode: 'KE', category: Category.FLAG, difficulty: Difficulty.MEDIUM },
          { questionId: 'w2', countryCode: 'NG', category: Category.CAPITAL, difficulty: Difficulty.HARD },
        ],
        startsAt: new Date(`${EVENT_ID}T00:00:00.000Z`),
        endsAt: new Date(`${EVENT_ID}T07:00:00.000Z`),
      };

      mocks.questionFindMany.mockResolvedValue(makeRegionPool());
      mocks.worldEventPlanFindUnique.mockResolvedValueOnce(null); // first: no existing
      mocks.worldEventPlanCreate.mockRejectedValueOnce({ code: 'P2002' }); // race lost
      mocks.worldEventPlanFindUnique.mockResolvedValueOnce(winnerPlan); // winner found

      const plan = await getOrCreateWorldEventPlan(EVENT_ID);

      expect(plan.eventId).toBe(EVENT_ID);
      expect(plan.questionIds).toEqual(['w1', 'w2']);
      expect(plan.version).toBe(WORLD_EVENT_VERSION);
    });

    it('returns existing plan without building again', async () => {
      const existing = {
        eventId: EVENT_ID,
        version: WORLD_EVENT_VERSION,
        region: REGION,
        questionIds: ['x1'],
        stops: [],
        startsAt: new Date(`${EVENT_ID}T00:00:00.000Z`),
        endsAt: new Date(`${EVENT_ID}T07:00:00.000Z`),
      };
      mocks.worldEventPlanFindUnique.mockResolvedValueOnce(existing);
      const plan = await getOrCreateWorldEventPlan(EVENT_ID);
      expect(plan.questionIds).toEqual(['x1']);
      expect(mocks.worldEventPlanCreate).not.toHaveBeenCalled();
    });
  });
});