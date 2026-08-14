import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Category, Difficulty } from '@prisma/client';
import {
  mapContinentToTourRegion,
  toPublicDailyTour,
  buildDailyTour,
  getOrCreateDailyTour,
  DAILY_TOUR_VERSION,
} from '../services/dailyTour.service.js';

const mocks = vi.hoisted(() => ({
  questionFindMany: vi.fn(),
  dailyPlanFindUnique: vi.fn(),
  dailyPlanFindMany: vi.fn(),
  dailyPlanCreate: vi.fn(),
}));

vi.mock('../config/database.js', () => {
  const prisma = {
    question: { findMany: mocks.questionFindMany },
    dailyChallengePlan: {
      findUnique: mocks.dailyPlanFindUnique,
      findMany: mocks.dailyPlanFindMany,
      create: mocks.dailyPlanCreate,
    },
  };
  return { prisma };
});

const POOL = Array.from({ length: 60 }, (_, i) => {
  const continents = ['Africa', 'Asia', 'Europe', 'Oceania', 'North America', 'South America'];
  const categories = [Category.FLAG, Category.CAPITAL, Category.SILHOUETTE, Category.MONUMENT, Category.CINEMA_GEO];
  return {
    id: `q-${i + 1}`,
    category: categories[i % categories.length],
    countryCode: `CC${String(i + 1).padStart(2, '0')}`,
    continent: continents[i % continents.length],
    difficulty: [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD][i % 3],
  };
});

function mockPool(questions = POOL) {
  mocks.questionFindMany.mockResolvedValue(questions);
}

function mockPreviousPlans(plans: Array<Partial<{ questionIds: string[]; stops: unknown[] }>> = []) {
  mocks.dailyPlanFindMany.mockResolvedValue(
    plans.map((p, i) => ({
      dayKey: `2026-01-${String(10 - i).padStart(2, '0')}`,
      version: DAILY_TOUR_VERSION,
      questionIds: p.questionIds ?? [],
      stops: p.stops ?? [],
      createdAt: new Date(),
    }))
  );
}

describe('mapContinentToTourRegion', () => {
  it('maps Africa → AFRICA', () => {
    expect(mapContinentToTourRegion('Africa')).toBe('AFRICA');
  });
  it('maps Asia → ASIA', () => {
    expect(mapContinentToTourRegion('Asia')).toBe('ASIA');
  });
  it('maps Europe → EUROPE', () => {
    expect(mapContinentToTourRegion('Europe')).toBe('EUROPE');
  });
  it('maps Oceania → OCEANIA', () => {
    expect(mapContinentToTourRegion('Oceania')).toBe('OCEANIA');
  });
  it('maps North America → AMERICAS', () => {
    expect(mapContinentToTourRegion('North America')).toBe('AMERICAS');
  });
  it('maps South America → AMERICAS', () => {
    expect(mapContinentToTourRegion('South America')).toBe('AMERICAS');
  });
  it('returns null for unknown continent', () => {
    expect(mapContinentToTourRegion('Antarctica')).toBeNull();
  });
});

describe('toPublicDailyTour', () => {
  it('returns public stops without countryCode', () => {
    const plan = {
      dayKey: '2026-01-01',
      version: DAILY_TOUR_VERSION,
      questionIds: ['q1'],
      stops: [{
        questionId: 'q1',
        countryCode: 'CL',
        category: Category.FLAG,
        region: 'AMERICAS' as const,
        difficulty: Difficulty.EASY,
      }],
    };
    const pub = toPublicDailyTour(plan);
    expect(pub.totalStops).toBe(1);
    expect(pub.stops[0]).toEqual({
      index: 0,
      region: 'AMERICAS',
      category: Category.FLAG,
      difficulty: Difficulty.EASY,
    });
    expect(pub.stops[0]).not.toHaveProperty('countryCode');
  });
});

describe('COMPOSITION', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool();
    mockPreviousPlans();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exactly 10 stops', async () => {
    const { plan } = await buildDailyTour('2026-06-15');
    expect(plan.stops).toHaveLength(10);
  });

  it('each region exactly 2 times', async () => {
    const { plan } = await buildDailyTour('2026-06-15');
    const counts: Record<string, number> = {};
    for (const s of plan.stops) {
      counts[s.region] = (counts[s.region] ?? 0) + 1;
    }
    expect(counts['AFRICA']).toBe(2);
    expect(counts['AMERICAS']).toBe(2);
    expect(counts['ASIA']).toBe(2);
    expect(counts['EUROPE']).toBe(2);
    expect(counts['OCEANIA']).toBe(2);
  });

  it('10 distinct countryCodes', async () => {
    const { plan } = await buildDailyTour('2026-06-15');
    const countries = new Set(plan.stops.map((s) => s.countryCode));
    expect(countries.size).toBe(10);
  });

  it('>= 4 categories', async () => {
    const { plan } = await buildDailyTour('2026-06-15');
    const cats = new Set(plan.stops.map((s) => s.category));
    expect(cats.size).toBeGreaterThanOrEqual(4);
  });

  it('max 3 questions per category', async () => {
    const { plan } = await buildDailyTour('2026-06-15');
    const counts: Record<string, number> = {};
    for (const s of plan.stops) {
      counts[s.category] = (counts[s.category] ?? 0) + 1;
    }
    for (const [, c] of Object.entries(counts)) {
      expect(c).toBeLessThanOrEqual(3);
    }
  });

  it('same dayKey + same pool => same plan', async () => {
    const p1 = await buildDailyTour('2026-06-15');
    const p2 = await buildDailyTour('2026-06-15');
    expect(p1.plan.questionIds).toEqual(p2.plan.questionIds);
    expect(p1.plan.stops.map((s) => s.countryCode)).toEqual(p2.plan.stops.map((s) => s.countryCode));
  });

  it('different day => different plan', async () => {
    const p1 = await buildDailyTour('2026-06-15');
    const p2 = await buildDailyTour('2026-06-16');
    expect(p1.plan.questionIds).not.toEqual(p2.plan.questionIds);
  });

  it('deterministic options ordering', async () => {
    // Verify the seed-based shuffle is deterministic
    const { plan } = await buildDailyTour('2026-06-15');
    const { plan: plan2 } = await buildDailyTour('2026-06-15');
    // Same stops in same order
    for (let i = 0; i < plan.stops.length; i++) {
      expect(plan.stops[i].questionId).toBe(plan2.stops[i].questionId);
      expect(plan.stops[i].region).toBe(plan2.stops[i].region);
    }
  });
});

describe('PERSISTENCE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('existing plan is reused', async () => {
    const existing = {
      dayKey: '2026-06-15',
      version: DAILY_TOUR_VERSION,
      questionIds: ['q-1', 'q-2', 'q-3', 'q-4', 'q-5', 'q-6', 'q-7', 'q-8', 'q-9', 'q-10'],
      stops: Array.from({ length: 10 }, (_, i) => ({
        questionId: `q-${i + 1}`,
        countryCode: `CC${String(i + 1).padStart(2, '0')}`,
        category: Category.FLAG,
        region: ['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA'][i % 5],
        difficulty: null,
      })),
      createdAt: new Date(),
    };
    mocks.dailyPlanFindUnique.mockResolvedValue(existing);

    const plan = await getOrCreateDailyTour('2026-06-15');
    expect(mocks.dailyPlanCreate).not.toHaveBeenCalled();
    expect(plan.questionIds).toEqual(existing.questionIds);
  });

  it('pool change does NOT alter persisted plan', async () => {
    const existing = {
      dayKey: '2026-06-15',
      version: DAILY_TOUR_VERSION,
      questionIds: ['q-1', 'q-2', 'q-3', 'q-4', 'q-5', 'q-6', 'q-7', 'q-8', 'q-9', 'q-10'],
      stops: Array.from({ length: 10 }, (_, i) => ({
        questionId: `q-${i + 1}`,
        countryCode: `CC${String(i + 1).padStart(2, '0')}`,
        category: Category.FLAG,
        region: ['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA'][i % 5],
        difficulty: null,
      })),
      createdAt: new Date(),
    };
    mocks.dailyPlanFindUnique.mockResolvedValue(existing);

    // Change pool
    mocks.questionFindMany.mockResolvedValue([]);

    const plan = await getOrCreateDailyTour('2026-06-15');
    expect(plan.questionIds).toEqual(existing.questionIds);
  });

  it('P2002 race recovers winner plan', async () => {
    mocks.dailyPlanFindUnique.mockResolvedValueOnce(null);
    mockPreviousPlans();
    const winner = {
      dayKey: '2026-06-15',
      version: DAILY_TOUR_VERSION,
      questionIds: ['q-1', 'q-2', 'q-3', 'q-4', 'q-5', 'q-6', 'q-7', 'q-8', 'q-9', 'q-10'],
      stops: Array.from({ length: 10 }, (_, i) => ({
        questionId: `q-${i + 1}`,
        countryCode: `CC${String(i + 1).padStart(2, '0')}`,
        category: Category.FLAG,
        region: ['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA'][i % 5],
        difficulty: null,
      })),
      createdAt: new Date(),
    };
    mocks.dailyPlanCreate.mockRejectedValueOnce({ code: 'P2002' });
    mocks.dailyPlanFindUnique.mockResolvedValueOnce(winner);

    const plan = await getOrCreateDailyTour('2026-06-15');
    expect(plan.questionIds).toEqual(winner.questionIds);
  });
});

describe('HISTORY', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('avoids questions from last 7 days when possible', async () => {
    mockPreviousPlans();
    const baseline = await buildDailyTour('2026-06-15');
    const recentQuestions = baseline.plan.questionIds.slice(0, 3);
    mockPreviousPlans([
      { questionIds: recentQuestions, stops: [] },
    ]);

    const { plan } = await buildDailyTour('2026-06-15');
    const usedIds = new Set(plan.questionIds);
    for (const questionId of recentQuestions) {
      expect(usedIds.has(questionId)).toBe(false);
    }
    expect(plan.stops).toHaveLength(10);
  });

  it('avoids recent countries when possible', async () => {
    mockPreviousPlans();
    const baseline = await buildDailyTour('2026-06-15');
    const recentCountries = baseline.plan.stops.slice(0, 4).map((s) => s.countryCode);
    mockPreviousPlans([
      {
        questionIds: baseline.plan.questionIds.slice(0, 4),
        stops: baseline.plan.stops.slice(0, 4).map((s, i) => ({
          questionId: s.questionId,
          countryCode: recentCountries[i],
          category: s.category,
          region: s.region,
          difficulty: s.difficulty,
        })),
      },
    ]);

    const { plan } = await buildDailyTour('2026-06-15');
    const usedCountries = new Set(plan.stops.map((s) => s.countryCode));
    for (const countryCode of recentCountries) {
      expect(usedCountries.has(countryCode)).toBe(false);
    }
    expect(plan.stops).toHaveLength(10);
  });

  it('relaxation tiers work without breaking hard invariants', async () => {
    // Simulate heavy history: all recent plans use same questions
    const allRecentIds = Array.from({ length: 50 }, (_, i) => `q-${i + 1}`);
    mockPreviousPlans(
      Array.from({ length: 7 }, (_, i) => ({
        questionIds: allRecentIds.slice(i * 5, i * 5 + 10),
        stops: [],
      }))
    );

    const { plan } = await buildDailyTour('2026-06-15');
    // Hard invariants must hold regardless of tier
    expect(plan.stops).toHaveLength(10);
    const countries = new Set(plan.stops.map((s) => s.countryCode));
    expect(countries.size).toBe(10);
    const cats = new Set(plan.stops.map((s) => s.category));
    expect(cats.size).toBeGreaterThanOrEqual(4);
  });
});

describe('365-DAY SIMULATION', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('365/365 generated, 0 invalid tours', async () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    let generated = 0;
    let invalid = 0;
    let regionFailures = 0;
    let countryFailures = 0;
    let categoryFailures = 0;
    let tierRelaxations: Record<number, number> = {};

    for (let day = 0; day < 365; day++) {
      const d = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
      const dayKey = d.toISOString().slice(0, 10);

      // Mock previous plans for history
      const prevPlans = [];
      for (let back = 1; back <= 7; back++) {
        const pd = new Date(startDate.getTime() + (day - back) * 24 * 60 * 60 * 1000);
        const pKey = pd.toISOString().slice(0, 10);
        // We don't actually need real data, just empty
        prevPlans.push({ questionIds: [], stops: [] });
      }
      mockPreviousPlans(prevPlans);

      try {
        const result = await buildDailyTour(dayKey);
        generated++;

        const { plan } = result;

        // Hard invariants
        if (plan.stops.length !== 10) {
          invalid++;
          continue;
        }

        const regionCounts: Record<string, number> = {};
        const catCounts: Record<string, number> = {};
        const countries = new Set<string>();

        for (const s of plan.stops) {
          regionCounts[s.region] = (regionCounts[s.region] ?? 0) + 1;
          catCounts[s.category] = (catCounts[s.category] ?? 0) + 1;
          countries.add(s.countryCode);
        }

        for (const r of ['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA']) {
          if (regionCounts[r] !== 2) regionFailures++;
        }
        if (countries.size !== 10) countryFailures++;
        if (Object.keys(catCounts).length < 4) categoryFailures++;
        for (const c of Object.values(catCounts)) {
          if (c > 3) categoryFailures++;
        }
      } catch {
        invalid++;
      }
    }

    expect(generated).toBe(365);
    expect(invalid).toBe(0);
    expect(regionFailures).toBe(0);
    expect(countryFailures).toBe(0);
    expect(categoryFailures).toBe(0);
  });
});

describe('VERSION constant', () => {
  it('DAILY_TOUR_VERSION is world-tour-v1', () => {
    expect(DAILY_TOUR_VERSION).toBe('world-tour-v1');
  });
});
