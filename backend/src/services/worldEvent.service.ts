import { Category, Difficulty, WorldEventRegion, WorldEventBossAttemptStatus, GameVariant, GameMode } from '@prisma/client';
import { prisma } from '../config/database.js';
import { hashString, seededShuffle } from '../utils/hash.js';

export const WORLD_EVENT_VERSION = 'weekly-world-event-v1' as const;
export const WORLD_EVENT_BOSS_VERSION = 'regional-boss-v1' as const;
export const BOSS_QUESTION_SECONDS = 20;
export const BOSS_SERVER_GRACE_MS = 1500;
export const BOSS_TOTAL_QUESTIONS = 10;
export const BOSS_HP_REQUIRED = 7;
export const BOSS_MAX_ATTEMPTS_PER_TIER = 200;

const BOSS_CATEGORIES = [
  Category.FLAG,
  Category.CAPITAL,
  Category.SILHOUETTE,
  Category.MONUMENT,
  Category.CINEMA_GEO,
];

const ALL_REGIONS: WorldEventRegion[] = ['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA'];

// Epoch: 2026-08-10 is AFRICA (index 0)
const EVENT_EPOCH = '2026-08-10';

export interface WorldEventWindow {
  eventId: string;
  startsAt: Date;
  endsAt: Date;
  region: WorldEventRegion;
}

export interface BossStop {
  questionId: string;
  countryCode: string;
  category: Category;
  difficulty: Difficulty | null;
}

export interface WorldEventPlanData {
  eventId: string;
  version: string;
  region: WorldEventRegion;
  questionIds: string[];
  stops: BossStop[];
  startsAt: Date;
  endsAt: Date;
}

export interface WorldEventProgress {
  correctInRegion: number;
  correctRequired: number;
  distinctCategories: number;
  categoriesRequired: number;
  dailyCompleted: boolean;
  bossUnlocked: boolean;
}

export interface PublicBossQuestion {
  questionId: string;
  category: Category;
  questionText: string;
  options: string[];
  imageUrl: string | null;
  questionData: string;
  difficulty: Difficulty | null;
}

/**
 * Pure function: compute the event window for any given timestamp.
 * Uses deterministic rotation: epoch + weeks mod 5.
 */
export function getWorldEventWindow(now: Date): WorldEventWindow {
  const epochMs = new Date(`${EVENT_EPOCH}T00:00:00.000Z`).getTime();
  const currentMs = now.getTime();

  // Find the Monday 00:00 UTC that contains `now`
  const daysSinceEpoch = Math.floor((currentMs - epochMs) / (7 * 24 * 60 * 60 * 1000));
  const startsAtMs = epochMs + daysSinceEpoch * 7 * 24 * 60 * 60 * 1000;
  const endsAtMs = startsAtMs + 7 * 24 * 60 * 60 * 1000;

  // Determine region: cycle every 5 weeks from epoch
  const weekIndex = ((daysSinceEpoch % 5) + 5) % 5;
  const region = ALL_REGIONS[weekIndex];

  const eventId = new Date(startsAtMs).toISOString().slice(0, 10);

  return {
    eventId,
    startsAt: new Date(startsAtMs),
    endsAt: new Date(endsAtMs),
    region,
  };
}

/**
 * Get the current world event window (now = server time).
 */
export function getCurrentWorldEvent(): WorldEventWindow {
  return getWorldEventWindow(new Date());
}

/**
 * Map a continent string to a WorldEventRegion.
 * Reuses the same semantics as Daily World Tour.
 */
export function mapContinentToEventRegion(continent: string): WorldEventRegion | null {
  switch (continent) {
    case 'Africa': return 'AFRICA';
    case 'Asia': return 'ASIA';
    case 'Europe': return 'EUROPE';
    case 'Oceania': return 'OCEANIA';
    case 'North America':
    case 'South America':
      return 'AMERICAS';
    default:
      return null;
  }
}

/**
 * Compute event progress for a user. All derived from persisted sources, no counters.
 */
export async function getWorldEventProgress(
  userId: string,
  eventId: string,
  region: WorldEventRegion,
): Promise<WorldEventProgress> {
  const window = await prisma.worldEventPlan.findUnique({ where: { eventId } });
  if (!window) {
    return {
      correctInRegion: 0,
      correctRequired: 8,
      distinctCategories: 0,
      categoriesRequired: 3,
      dailyCompleted: false,
      bossUnlocked: false,
    };
  }

  // Get all correct MasteryAttempts for this user during the event window,
  // in countries belonging to the event region
  const attempts = await prisma.masteryAttempt.findMany({
    where: {
      userId,
      isCorrect: true,
      occurredAt: { gte: window.startsAt, lt: window.endsAt },
    },
    select: {
      countryCode: true,
      category: true,
    },
  });

  // Filter to attempts in the event region
  const regionAttempts = attempts.filter((a) => {
    // We need to resolve countryCode to region via Question.continent
    // For now, we'll count all correct attempts and filter by region in the query
    return true; // Will be filtered below
  });

  // Get questions to resolve continent -> region
  const countryCodes = [...new Set(regionAttempts.map((a) => a.countryCode))];
  const questions = await prisma.question.findMany({
    where: { countryCode: { in: countryCodes } },
    select: { countryCode: true, continent: true },
  });

  const countryCodeToRegion = new Map<string, WorldEventRegion>();
  for (const q of questions) {
    if (q.countryCode && q.continent) {
      const r = mapContinentToEventRegion(q.continent);
      if (r) countryCodeToRegion.set(q.countryCode, r);
    }
  }

  const correctInRegion = regionAttempts.filter((a) => {
    const r = countryCodeToRegion.get(a.countryCode);
    return r === region;
  });

  const distinctCategories = new Set(correctInRegion.map((a) => a.category));

  // Check Daily completion during event window
  const dailyCompleted = await prisma.gameResult.findFirst({
    where: {
      userId,
      variant: GameVariant.DAILY,
      createdAt: { gte: window.startsAt, lt: window.endsAt },
    },
    select: { id: true },
  });

  const correctInRegionCount = correctInRegion.length;
  const distinctCategoriesCount = distinctCategories.size;
  const dailyDone = dailyCompleted !== null;
  const bossUnlocked = correctInRegionCount >= 8 && distinctCategoriesCount >= 3 && dailyDone;

  return {
    correctInRegion: correctInRegionCount,
    correctRequired: 8,
    distinctCategories: distinctCategoriesCount,
    categoriesRequired: 3,
    dailyCompleted: dailyDone,
    bossUnlocked,
  };
}

/**
 * Fetch the question pool for boss generation.
 */
async function fetchBossPool(): Promise<Array<{
  id: string;
  category: Category;
  countryCode: string;
  continent: string;
  difficulty: Difficulty | null;
}>> {
  const raw = await prisma.question.findMany({
    where: {
      isAvailable: true,
      countryCode: { not: null },
      continent: { not: null },
      category: { in: BOSS_CATEGORIES },
    },
    select: {
      id: true,
      category: true,
      countryCode: true,
      continent: true,
      difficulty: true,
    },
    orderBy: { id: 'asc' },
  });
  return raw
    .filter((q) => q.countryCode !== null && q.continent !== null)
    .map((q) => ({
      id: q.id,
      category: q.category,
      countryCode: q.countryCode!,
      continent: q.continent!,
      difficulty: q.difficulty,
    }));
}

/**
 * Try to build a boss question set for a given tier.
 */
function tryBuildBoss(
  pool: Array<{ id: string; category: Category; countryCode: string; continent: string; difficulty: Difficulty | null }>,
  region: WorldEventRegion,
  eventId: string,
  tier: number,
  attempt: number,
): BossStop[] | null {
  // Filter to region
  const regionPool = pool.filter((q) => {
    const r = mapContinentToEventRegion(q.continent);
    if (r !== region) return false;
    // Tier 1: MEDIUM/HARD only
    if (tier === 1 && q.difficulty !== 'MEDIUM' && q.difficulty !== 'HARD') return false;
    return true;
  });

  if (regionPool.length < BOSS_TOTAL_QUESTIONS) return null;

  const usedQuestions = new Set<string>();
  const usedCountries = new Set<string>();
  const categoryCounts = new Map<Category, number>();
  const stops: BossStop[] = [];

  for (let i = 0; i < BOSS_TOTAL_QUESTIONS; i++) {
    const candidates = regionPool.filter((q) => {
      if (usedQuestions.has(q.id)) return false;
      if (usedCountries.has(q.countryCode)) return false;
      const catCount = categoryCounts.get(q.category) ?? 0;
      if (catCount >= 4) return false; // <=4 per category
      return true;
    });

    if (candidates.length === 0) return null;

    const jitterSeed = hashString(`${eventId}:boss:${WORLD_EVENT_BOSS_VERSION}:attempt:${attempt}:slot:${i}`);
    const shuffled = seededShuffle(candidates, jitterSeed);

    const prevCategory = i > 0 ? stops[i - 1].category : null;
    let best = shuffled[0];
    let bestScore = -Infinity;

    for (const q of shuffled) {
      let score = 0;
      const catCount = categoryCounts.get(q.category) ?? 0;
      score -= catCount * 10;
      if (q.category === prevCategory) score -= 5;
      score += hashString(`${eventId}:boss:${attempt}:${q.id}`) % 100;
      if (score > bestScore) {
        bestScore = score;
        best = q;
      }
    }

    usedQuestions.add(best.id);
    usedCountries.add(best.countryCode);
    categoryCounts.set(best.category, (categoryCounts.get(best.category) ?? 0) + 1);

    stops.push({
      questionId: best.id,
      countryCode: best.countryCode,
      category: best.category,
      difficulty: best.difficulty,
    });
  }

  // Validate invariants
  if (stops.length !== BOSS_TOTAL_QUESTIONS) return null;
  const uniqueCountries = new Set(stops.map((s) => s.countryCode));
  if (uniqueCountries.size !== BOSS_TOTAL_QUESTIONS) return null;
  const uniqueCategories = new Set(stops.map((s) => s.category));
  if (uniqueCategories.size < 3) return null; // >=3 categories
  for (const [, count] of categoryCounts) {
    if (count > 4) return null; // <=4 per category
  }

  return stops;
}

/**
 * Build a boss plan for the given event.
 */
export async function buildWorldEventBoss(
  eventId: string,
  region: WorldEventRegion,
): Promise<{ plan: WorldEventPlanData; tier: number }> {
  const pool = await fetchBossPool();

  // Tier 1: MEDIUM/HARD only
  for (let attempt = 0; attempt < BOSS_MAX_ATTEMPTS_PER_TIER; attempt++) {
    const stops = tryBuildBoss(pool, region, eventId, 1, attempt);
    if (stops) {
      return {
        plan: {
          eventId,
          version: WORLD_EVENT_BOSS_VERSION,
          region,
          questionIds: stops.map((s) => s.questionId),
          stops,
          startsAt: new Date(`${eventId}T00:00:00.000Z`),
          endsAt: new Date(new Date(`${eventId}T00:00:00.000Z`).getTime() + 7 * 24 * 60 * 60 * 1000),
        },
        tier: 1,
      };
    }
  }

  // Tier 2: any difficulty
  for (let attempt = 0; attempt < BOSS_MAX_ATTEMPTS_PER_TIER; attempt++) {
    const stops = tryBuildBoss(pool, region, eventId, 2, attempt);
    if (stops) {
      return {
        plan: {
          eventId,
          version: WORLD_EVENT_BOSS_VERSION,
          region,
          questionIds: stops.map((s) => s.questionId),
          stops,
          startsAt: new Date(`${eventId}T00:00:00.000Z`),
          endsAt: new Date(new Date(`${eventId}T00:00:00.000Z`).getTime() + 7 * 24 * 60 * 60 * 1000),
        },
        tier: 2,
      };
    }
  }

  throw new Error('EVENT_BOSS_POOL_INSUFFICIENT');
}

/**
 * Get or create the world event plan. P2002 race handling.
 */
export async function getOrCreateWorldEventPlan(eventId: string): Promise<WorldEventPlanData> {
  const existing = await prisma.worldEventPlan.findUnique({ where: { eventId } });
  if (existing) {
    return {
      eventId: existing.eventId,
      version: existing.version,
      region: existing.region,
      questionIds: existing.questionIds as unknown as string[],
      stops: existing.stops as unknown as BossStop[],
      startsAt: existing.startsAt,
      endsAt: existing.endsAt,
    };
  }

  const window = getWorldEventWindow(new Date(`${eventId}T12:00:00.000Z`));
  const { plan } = await buildWorldEventBoss(eventId, window.region);

  try {
    await prisma.worldEventPlan.create({
      data: {
        eventId: plan.eventId,
        version: plan.version,
        region: plan.region,
        questionIds: plan.questionIds as unknown as any,
        stops: plan.stops as unknown as any,
        startsAt: plan.startsAt,
        endsAt: plan.endsAt,
      },
    });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      const winner = await prisma.worldEventPlan.findUnique({ where: { eventId } });
      if (winner) {
        return {
          eventId: winner.eventId,
          version: winner.version,
          region: winner.region,
          questionIds: winner.questionIds as unknown as string[],
          stops: winner.stops as unknown as BossStop[],
          startsAt: winner.startsAt,
          endsAt: winner.endsAt,
        };
      }
    }
    throw e;
  }

  return plan;
}

/**
 * Convert a boss stop to a public question (no correctAnswer, no countryCode).
 */
export function toPublicBossQuestion(
  plan: WorldEventPlanData,
  questionIndex: number,
  questionData: { id: string; category: Category; questionData: string; options: string[]; imageUrl: string | null; difficulty: Difficulty | null },
): PublicBossQuestion {
  return {
    questionId: questionData.id,
    category: questionData.category,
    questionText: questionData.questionData,
    options: questionData.options,
    imageUrl: questionData.imageUrl,
    questionData: questionData.questionData,
    difficulty: questionData.difficulty,
  };
}
