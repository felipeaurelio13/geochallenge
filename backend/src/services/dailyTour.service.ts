import { Category, Difficulty } from '@prisma/client';
import { prisma } from '../config/database.js';

export const DAILY_TOUR_VERSION = 'world-tour-v1' as const;

const DAILY_TOUR_CATEGORIES = [
  Category.FLAG,
  Category.CAPITAL,
  Category.SILHOUETTE,
  Category.MONUMENT,
  Category.CINEMA_GEO,
];

const ALL_REGIONS = ['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA'] as const;
const DAILY_TOUR_STOPS = 10;
const STOPS_PER_REGION = 2;
const MAX_DAILY_ROUTE_ATTEMPTS = 200;
const MIN_CATEGORIES = 4;
const MAX_PER_CATEGORY = 3;

export type DailyTourRegion = 'AFRICA' | 'AMERICAS' | 'ASIA' | 'EUROPE' | 'OCEANIA';

export interface DailyTourStop {
  questionId: string;
  countryCode: string;
  category: Category;
  region: DailyTourRegion;
  difficulty: Difficulty | null;
}

export interface DailyTourPlan {
  dayKey: string;
  version: 'world-tour-v1';
  questionIds: string[];
  stops: DailyTourStop[];
}

interface PoolQuestion {
  id: string;
  category: Category;
  countryCode: string;
  continent: string;
  difficulty: Difficulty | null;
}

interface PreviousDayData {
  questionIds: Set<string>;
  countryCodes: Set<string>;
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = ((s * 1664525) + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function mapContinentToTourRegion(continent: string): DailyTourRegion | null {
  switch (continent) {
    case 'Africa':
      return 'AFRICA';
    case 'Asia':
      return 'ASIA';
    case 'Europe':
      return 'EUROPE';
    case 'Oceania':
      return 'OCEANIA';
    case 'North America':
    case 'South America':
      return 'AMERICAS';
    default:
      return null;
  }
}

async function getPreviousDayData(dayKey: string, lookback: number): Promise<PreviousDayData[]> {
  const keys: string[] = [];
  const baseMs = new Date(`${dayKey}T00:00:00.000Z`).getTime();
  for (let i = 1; i <= lookback; i++) {
    const d = new Date(baseMs - i * 24 * 60 * 60 * 1000);
    keys.push(d.toISOString().slice(0, 10));
  }

  const plans = await prisma.dailyChallengePlan.findMany({
    where: { dayKey: { in: keys } },
    orderBy: { dayKey: 'desc' },
  });

  return plans.map((p) => ({
    questionIds: new Set<string>(p.questionIds as unknown as string[]),
    countryCodes: extractCountryCodes(p.stops as unknown as DailyTourStop[]),
  }));
}

function extractCountryCodes(stops: DailyTourStop[]): Set<string> {
  return new Set(stops.map((s) => s.countryCode));
}

function generateRegionOrder(dayKey: string): DailyTourRegion[] {
  const seed1 = hashString(`${dayKey}:lap1`);
  const seed2 = hashString(`${dayKey}:lap2`);

  const lap1 = seededShuffle([...ALL_REGIONS], seed1);
  let lap2 = seededShuffle([...ALL_REGIONS], seed2);

  if (lap1[4] === lap2[0]) {
    lap2 = [lap2[1], lap2[2], lap2[3], lap2[4], lap2[0]];
  }

  return [...lap1, ...lap2];
}

async function fetchPool(): Promise<PoolQuestion[]> {
  const raw = await prisma.question.findMany({
    where: {
      isAvailable: true,
      countryCode: { not: null },
      continent: { not: null },
      category: { in: DAILY_TOUR_CATEGORIES },
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

function groupPoolByRegion(pool: PoolQuestion[]): Map<DailyTourRegion, PoolQuestion[]> {
  const map = new Map<DailyTourRegion, PoolQuestion[]>();
  for (const q of pool) {
    const region = mapContinentToTourRegion(q.continent);
    if (!region) continue;
    if (!map.has(region)) map.set(region, []);
    map.get(region)!.push(q);
  }
  return map;
}

interface SelectionResult {
  stops: DailyTourStop[];
  tier: number;
}

function selectQuestionsForRegionOrder(
  regionOrder: DailyTourRegion[],
  poolByRegion: Map<DailyTourRegion, PoolQuestion[]>,
  previousDays: PreviousDayData[],
  dayKey: string,
): SelectionResult | null {
  for (let tier = 1; tier <= 4; tier++) {
    const result = tryBuildTour(regionOrder, poolByRegion, previousDays, dayKey, tier);
    if (result) return { stops: result, tier };
  }
  return null;
}

function tryBuildTour(
  regionOrder: DailyTourRegion[],
  poolByRegion: Map<DailyTourRegion, PoolQuestion[]>,
  previousDays: PreviousDayData[],
  dayKey: string,
  tier: number,
): DailyTourStop[] | null {
  const usedQuestions = new Set<string>();
  const usedCountries = new Set<string>();
  const categoryCounts = new Map<Category, number>();
  const stops: DailyTourStop[] = [];

  const excludeQuestions = new Set<string>();
  const excludeCountries = new Set<string>();

  if (tier <= 1 || tier <= 2 || tier <= 3) {
    const qLookback = tier <= 3 ? 3 : 7;
    for (let i = 0; i < Math.min(previousDays.length, qLookback); i++) {
      for (const qid of previousDays[i].questionIds) {
        excludeQuestions.add(qid);
      }
    }
  }
  if (tier <= 1) {
    for (let i = 0; i < Math.min(previousDays.length, 2); i++) {
      for (const cc of previousDays[i].countryCodes) {
        excludeCountries.add(cc);
      }
    }
  }

  for (let i = 0; i < regionOrder.length; i++) {
    const region = regionOrder[i];
    const candidates = poolByRegion.get(region) ?? [];

    const filtered = candidates.filter((q) => {
      if (usedQuestions.has(q.id)) return false;
      if (excludeQuestions.has(q.id)) return false;
      if (usedCountries.has(q.countryCode)) return false;
      if (tier <= 1 && excludeCountries.has(q.countryCode)) return false;
      const catCount = categoryCounts.get(q.category) ?? 0;
      if (catCount >= MAX_PER_CATEGORY) return false;
      return true;
    });

    if (filtered.length === 0) return null;

    const jitterSeed = hashString(`${dayKey}:slot:${i}`);
    const shuffled = seededShuffle(filtered, jitterSeed);

    const prevCategory = i > 0 ? stops[i - 1].category : null;

    let best: PoolQuestion | null = null;
    let bestScore = -Infinity;

    for (const q of shuffled) {
      let score = 0;
      const catCount = categoryCounts.get(q.category) ?? 0;
      score -= catCount * 10;
      if (q.category === prevCategory) score -= 5;
      score += hashString(`${dayKey}:${q.id}`) % 100;
      if (score > bestScore) {
        bestScore = score;
        best = q;
      }
    }

    if (!best) return null;

    usedQuestions.add(best.id);
    usedCountries.add(best.countryCode);
    categoryCounts.set(best.category, (categoryCounts.get(best.category) ?? 0) + 1);

    stops.push({
      questionId: best.id,
      countryCode: best.countryCode,
      category: best.category,
      region,
      difficulty: best.difficulty,
    });
  }

  if (stops.length !== DAILY_TOUR_STOPS) return null;

  const uniqueCountries = new Set(stops.map((s) => s.countryCode));
  if (uniqueCountries.size !== DAILY_TOUR_STOPS) return null;

  const uniqueCategories = new Set(stops.map((s) => s.category));
  if (uniqueCategories.size < MIN_CATEGORIES) return null;

  for (const [, count] of categoryCounts) {
    if (count > MAX_PER_CATEGORY) return null;
  }

  const regionCounts = new Map<string, number>();
  for (const s of stops) {
    regionCounts.set(s.region, (regionCounts.get(s.region) ?? 0) + 1);
  }
  for (const r of ALL_REGIONS) {
    if (regionCounts.get(r) !== STOPS_PER_REGION) return null;
  }

  return stops;
}

export async function buildDailyTour(dayKey: string): Promise<{ plan: DailyTourPlan; tier: number }> {
  const pool = await fetchPool();
  const poolByRegion = groupPoolByRegion(pool);

  for (const r of ALL_REGIONS) {
    const count = poolByRegion.get(r)?.length ?? 0;
    if (count < STOPS_PER_REGION) {
      throw new Error(`DAILY_TOUR_INSUFFICIENT_POOL: ${r} has only ${count} questions`);
    }
  }

  const previousDays = await getPreviousDayData(dayKey, 7);
  const regionOrder = generateRegionOrder(dayKey);

  const selection = selectQuestionsForRegionOrder(regionOrder, poolByRegion, previousDays, dayKey);
  if (!selection) {
    throw new Error('DAILY_TOUR_GENERATION_FAILED');
  }

  const plan: DailyTourPlan = {
    dayKey,
    version: DAILY_TOUR_VERSION,
    questionIds: selection.stops.map((s) => s.questionId),
    stops: selection.stops,
  };

  return { plan, tier: selection.tier };
}

export async function getOrCreateDailyTour(dayKey: string): Promise<DailyTourPlan> {
  const existing = await prisma.dailyChallengePlan.findUnique({
    where: { dayKey },
  });

  if (existing) {
    return {
      dayKey: existing.dayKey,
      version: existing.version as 'world-tour-v1',
      questionIds: existing.questionIds as unknown as string[],
      stops: existing.stops as unknown as DailyTourStop[],
    };
  }

  const { plan } = await buildDailyTour(dayKey);

  try {
    await prisma.dailyChallengePlan.create({
      data: {
        dayKey: plan.dayKey,
        version: plan.version,
        questionIds: plan.questionIds as unknown as any,
        stops: plan.stops as unknown as any,
      },
    });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      const winner = await prisma.dailyChallengePlan.findUnique({
        where: { dayKey },
      });
      if (winner) {
        return {
          dayKey: winner.dayKey,
          version: winner.version as 'world-tour-v1',
          questionIds: winner.questionIds as unknown as string[],
          stops: winner.stops as unknown as DailyTourStop[],
        };
      }
    }
    throw e;
  }

  return plan;
}

export interface PublicTourStop {
  index: number;
  region: DailyTourRegion;
  category: Category;
  difficulty?: Difficulty | null;
}

export interface PublicDailyTour {
  totalStops: number;
  stops: PublicTourStop[];
}

export function toPublicDailyTour(plan: DailyTourPlan): PublicDailyTour {
  return {
    totalStops: plan.stops.length,
    stops: plan.stops.map((stop, index) => ({
      index,
      region: stop.region,
      category: stop.category,
      difficulty: stop.difficulty,
    })),
  };
}
