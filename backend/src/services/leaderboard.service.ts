import { getRedis } from '../config/redis.js';
import { prisma } from '../config/database.js';
import type { Prisma } from '@prisma/client';

const LEADERBOARD_KEY = 'leaderboard:global';
const SEASON_LEADERBOARD_KEY_PREFIX = 'leaderboard:season';
const STATS_AVG_KEY = 'leaderboard:stats:avg:global';
const STATS_AVG_TTL = 3600; // 1 hour

export type LeaderboardScope = 'global' | 'season';

export type LeaderboardModeFilter = 'SINGLE' | 'DUEL' | 'CHALLENGE' | 'SURVIVAL';
export type LeaderboardCategoryFilter =
  | 'MAP'
  | 'FLAG'
  | 'CAPITAL'
  | 'SILHOUETTE'
  | 'MONUMENT'
  | 'CINEMA_GEO'
  | 'MIXED';

export interface LeaderboardFilters {
  mode?: LeaderboardModeFilter;
  category?: LeaderboardCategoryFilter;
  minGames?: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
  gamesPlayed?: number;
  bestScore?: number;
}

export interface LeaderboardStats {
  totalPlayers: number;
  topScore: number | null;
  avgScore: number | null;
}

export function getCurrentSeasonId(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

function getSeasonLeaderboardKey(seasonId: string): string {
  return `${SEASON_LEADERBOARD_KEY_PREFIX}:${seasonId}`;
}

function seasonRange(seasonId: string): { startDate: Date; endDate: Date } {
  const [year, month] = seasonId.split('-').map(Number);
  if (!year || !month) {
    throw new Error(`Invalid seasonId: ${seasonId} (expected YYYY-MM)`);
  }
  return {
    startDate: new Date(Date.UTC(year, month - 1, 1)),
    endDate: new Date(Date.UTC(year, month, 1)),
  };
}

function hasFilters(filters?: LeaderboardFilters): boolean {
  if (!filters) return false;
  if (filters.mode) return true;
  if (filters.category) return true;
  if (typeof filters.minGames === 'number' && filters.minGames > 1) return true;
  return false;
}

function buildGameResultWhere(
  scope: LeaderboardScope,
  seasonId: string,
  filters?: LeaderboardFilters
): Prisma.GameResultWhereInput {
  const where: Prisma.GameResultWhereInput = {};
  if (scope === 'season') {
    const { startDate, endDate } = seasonRange(seasonId);
    where.createdAt = { gte: startDate, lt: endDate };
  }
  if (filters?.mode) where.gameMode = filters.mode;
  if (filters?.category) where.category = filters.category;
  return where;
}

interface AggregatedRow {
  userId: string;
  score: number;
  bestScore: number;
  gamesPlayed: number;
}

/**
 * Aggregates GameResult rows into a ranked list.
 * - scope='global'  → score = MAX(score)         (best ever per user)
 * - scope='season'  → score = SUM(score)         (total in the period)
 * Both always include bestScore (MAX) and gamesPlayed (COUNT).
 * minGames filters out users with fewer plays after aggregation.
 */
async function aggregateRankedFromDb(opts: {
  scope: LeaderboardScope;
  seasonId: string;
  filters?: LeaderboardFilters;
  limit?: number;
}): Promise<AggregatedRow[]> {
  const { scope, seasonId, filters, limit } = opts;
  const where = buildGameResultWhere(scope, seasonId, filters);
  const minGames = Math.max(1, filters?.minGames ?? 1);

  const rows = await prisma.gameResult.groupBy({
    by: ['userId'],
    where,
    _sum: { score: true },
    _max: { score: true },
    _count: { _all: true },
  });

  const aggregated: AggregatedRow[] = [];
  for (const r of rows) {
    const sum = r._sum.score ?? 0;
    const best = r._max.score ?? 0;
    const games = r._count._all ?? 0;
    if (games < minGames) continue;
    const score = scope === 'season' ? sum : best;
    if (score <= 0) continue;
    aggregated.push({ userId: r.userId, score, bestScore: best, gamesPlayed: games });
  }

  aggregated.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break by gamesPlayed descending (more activity wins ties) then userId for stability
    if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
    return a.userId.localeCompare(b.userId);
  });

  return typeof limit === 'number' ? aggregated.slice(0, limit) : aggregated;
}

async function attachUsernames(
  entries: AggregatedRow[],
  baseRank: number
): Promise<LeaderboardEntry[]> {
  if (entries.length === 0) return [];
  const userIds = entries.map((e) => e.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.username]));
  const resolved: LeaderboardEntry[] = [];
  for (const entry of entries) {
    const username = userMap.get(entry.userId);
    if (!username) continue;
    resolved.push({
      rank: baseRank + resolved.length,
      userId: entry.userId,
      username,
      score: entry.score,
      bestScore: entry.bestScore,
      gamesPlayed: entry.gamesPlayed,
    });
  }
  return resolved;
}

// --- Postgres unfiltered global path (uses User.highScore as canonical "best ever") ---

async function getTopGlobalFromDb(count: number): Promise<LeaderboardEntry[]> {
  const users = await prisma.user.findMany({
    where: { highScore: { gt: 0 } },
    orderBy: [{ highScore: 'desc' }, { id: 'asc' }],
    take: count,
    select: { id: true, username: true, highScore: true, gamesPlayed: true },
  });
  return users.map((u, i) => ({
    rank: i + 1,
    userId: u.id,
    username: u.username,
    score: u.highScore,
    bestScore: u.highScore,
    gamesPlayed: u.gamesPlayed,
  }));
}

async function getGlobalStatsFromDb(): Promise<LeaderboardStats> {
  const result = await prisma.user.aggregate({
    where: { highScore: { gt: 0 } },
    _count: { id: true },
    _max: { highScore: true },
    _avg: { highScore: true },
  });
  return {
    totalPlayers: result._count.id,
    topScore: result._max.highScore,
    avgScore: result._avg.highScore,
  };
}

async function getGlobalUserRankFromDb(
  userId: string
): Promise<{ rank: number | null; score: number | null } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { highScore: true },
  });
  if (!user || user.highScore === 0) return null;
  const usersAbove = await prisma.user.count({
    where: { highScore: { gt: user.highScore } },
  });
  return { rank: usersAbove + 1, score: user.highScore };
}

// --- Filtered / season aggregates from DB ---

async function getTopFromDbWithFilters(
  scope: LeaderboardScope,
  seasonId: string,
  filters: LeaderboardFilters | undefined,
  count: number
): Promise<LeaderboardEntry[]> {
  const aggregates = await aggregateRankedFromDb({ scope, seasonId, filters, limit: count });
  return attachUsernames(aggregates, 1);
}

async function getStatsFromDbWithFilters(
  scope: LeaderboardScope,
  seasonId: string,
  filters: LeaderboardFilters | undefined
): Promise<LeaderboardStats> {
  const aggregates = await aggregateRankedFromDb({ scope, seasonId, filters });
  if (aggregates.length === 0) {
    return { totalPlayers: 0, topScore: null, avgScore: null };
  }
  const total = aggregates.length;
  const top = aggregates[0].score;
  const sum = aggregates.reduce((s, a) => s + a.score, 0);
  return { totalPlayers: total, topScore: top, avgScore: sum / total };
}

async function getUserRankFromDbWithFilters(
  scope: LeaderboardScope,
  seasonId: string,
  filters: LeaderboardFilters | undefined,
  userId: string
): Promise<{ rank: number | null; score: number | null } | null> {
  const aggregates = await aggregateRankedFromDb({ scope, seasonId, filters });
  const idx = aggregates.findIndex((a) => a.userId === userId);
  if (idx === -1) return null;
  return { rank: idx + 1, score: aggregates[idx].score };
}

// --- Write operations (idempotent: only write if higher) ---
// Kept for backward compatibility with existing call sites. The unfiltered
// global Redis ZSET tracks User.highScore. The season ZSET is no longer
// consulted on reads (we compute SUM from DB), but writes are retained so
// any legacy rebuild that still uses it remains coherent.

export async function updateLeaderboardScore(userId: string, score: number): Promise<boolean> {
  if (!Number.isFinite(score) || score <= 0) return false;
  try {
    const redis = getRedis();
    const currentScore = await redis.zscore(LEADERBOARD_KEY, userId);
    if (currentScore === null || score > parseFloat(currentScore)) {
      await redis.zadd(LEADERBOARD_KEY, score, userId);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[leaderboard] Failed to update global Redis score (DB remains source of truth):', err);
    return false;
  }
}

export async function updateSeasonLeaderboardScore(
  userId: string,
  score: number,
  seasonId: string = getCurrentSeasonId()
): Promise<boolean> {
  if (!Number.isFinite(score) || score <= 0) return false;
  try {
    const redis = getRedis();
    const seasonKey = getSeasonLeaderboardKey(seasonId);
    const currentScore = await redis.zscore(seasonKey, userId);
    if (currentScore === null || score > parseFloat(currentScore)) {
      await redis.zadd(seasonKey, score, userId);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[leaderboard] Failed to update season Redis score (DB remains source of truth):', err);
    return false;
  }
}

// --- Read operations ---
// Unfiltered global → Redis ZSET (User.highScore). Anything else → DB aggregate.

export async function getTopLeaderboard(
  count: number = 50,
  filters?: LeaderboardFilters
): Promise<LeaderboardEntry[]> {
  const clamped = Math.min(Math.max(count, 1), 500);

  if (hasFilters(filters)) {
    return getTopFromDbWithFilters('global', getCurrentSeasonId(), filters, clamped);
  }

  try {
    const redis = getRedis();
    const results = await redis.zrevrange(LEADERBOARD_KEY, 0, clamped - 1, 'WITHSCORES');
    if (results.length === 0) {
      return getTopGlobalFromDb(clamped);
    }
    const entries: AggregatedRow[] = [];
    for (let i = 0; i < results.length; i += 2) {
      const score = parseFloat(results[i + 1]);
      entries.push({ userId: results[i], score, bestScore: score, gamesPlayed: 0 });
    }
    const withUsernames = await attachUsernames(entries, 1);
    // Backfill gamesPlayed from User table for the Redis path
    if (withUsernames.length > 0) {
      const ids = withUsernames.map((e) => e.userId);
      const counts = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, gamesPlayed: true },
      });
      const byId = new Map(counts.map((u) => [u.id, u.gamesPlayed]));
      for (const e of withUsernames) {
        e.gamesPlayed = byId.get(e.userId) ?? 0;
      }
    }
    return withUsernames;
  } catch {
    console.warn('[leaderboard] Redis unavailable, falling back to DB for global leaderboard');
    return getTopGlobalFromDb(clamped);
  }
}

export async function getSeasonLeaderboard(
  count: number = 50,
  seasonId: string = getCurrentSeasonId(),
  filters?: LeaderboardFilters
): Promise<LeaderboardEntry[]> {
  const clamped = Math.min(Math.max(count, 1), 500);
  return getTopFromDbWithFilters('season', seasonId, filters, clamped);
}

export async function getUserRank(
  userId: string,
  filters?: LeaderboardFilters
): Promise<{ rank: number | null; score: number | null } | null> {
  if (hasFilters(filters)) {
    return getUserRankFromDbWithFilters('global', getCurrentSeasonId(), filters, userId);
  }
  try {
    const redis = getRedis();
    const rank = await redis.zrevrank(LEADERBOARD_KEY, userId);
    const score = await redis.zscore(LEADERBOARD_KEY, userId);
    if (rank === null || score === null) {
      return getGlobalUserRankFromDb(userId);
    }
    return { rank: rank + 1, score: parseFloat(score) };
  } catch {
    console.warn('[leaderboard] Redis unavailable, falling back to DB for user rank');
    return getGlobalUserRankFromDb(userId);
  }
}

export async function getSeasonUserRank(
  userId: string,
  seasonId: string = getCurrentSeasonId(),
  filters?: LeaderboardFilters
): Promise<{ rank: number | null; score: number | null } | null> {
  return getUserRankFromDbWithFilters('season', seasonId, filters, userId);
}

export async function getLeaderboardStats(
  filters?: LeaderboardFilters
): Promise<LeaderboardStats> {
  if (hasFilters(filters)) {
    return getStatsFromDbWithFilters('global', getCurrentSeasonId(), filters);
  }
  try {
    const redis = getRedis();
    const totalPlayers = await redis.zcard(LEADERBOARD_KEY);
    if (totalPlayers === 0) {
      return getGlobalStatsFromDb();
    }
    const topResults = await redis.zrevrange(LEADERBOARD_KEY, 0, 0, 'WITHSCORES');
    const topScore = topResults.length >= 2 ? parseFloat(topResults[1]) : null;

    const cachedAvg = await redis.get(STATS_AVG_KEY);
    let avgScore: number | null = null;
    if (cachedAvg !== null) {
      avgScore = parseFloat(cachedAvg);
    } else {
      const dbStats = await getGlobalStatsFromDb();
      avgScore = dbStats.avgScore;
      if (avgScore !== null) {
        await redis.set(STATS_AVG_KEY, avgScore.toString(), 'EX', STATS_AVG_TTL);
      }
    }

    return { totalPlayers, topScore, avgScore };
  } catch {
    console.warn('[leaderboard] Redis unavailable, falling back to DB for stats');
    return getGlobalStatsFromDb();
  }
}

export async function getSeasonLeaderboardStats(
  seasonId: string = getCurrentSeasonId(),
  filters?: LeaderboardFilters
): Promise<LeaderboardStats> {
  return getStatsFromDbWithFilters('season', seasonId, filters);
}

/**
 * Returns leaderboard context around a user (neighbors above/below).
 * For unfiltered global, uses Redis. For season or filtered, uses DB aggregation.
 */
export async function getUserLeaderboardContext(
  userId: string,
  surrounding: number = 3,
  scope: LeaderboardScope = 'global',
  filters?: LeaderboardFilters
): Promise<{ userRank: LeaderboardEntry | null; neighbors: LeaderboardEntry[] }> {
  if (scope === 'season' || hasFilters(filters)) {
    const seasonId = getCurrentSeasonId();
    const aggregates = await aggregateRankedFromDb({ scope, seasonId, filters });
    const idx = aggregates.findIndex((a) => a.userId === userId);
    if (idx === -1) return { userRank: null, neighbors: [] };
    const start = Math.max(0, idx - surrounding);
    const end = Math.min(aggregates.length, idx + surrounding + 1);
    const slice = aggregates.slice(start, end);
    const neighbors = await attachUsernames(slice, start + 1);
    const userRank = neighbors.find((n) => n.userId === userId) ?? null;
    return { userRank, neighbors };
  }

  const userRankInfo = await getUserRank(userId);
  if (!userRankInfo || userRankInfo.rank === null || userRankInfo.score === null) {
    return { userRank: null, neighbors: [] };
  }

  try {
    const redis = getRedis();
    const rank = userRankInfo.rank;
    const start = Math.max(0, rank - 1 - surrounding);
    const end = rank - 1 + surrounding;
    const results = await redis.zrevrange(LEADERBOARD_KEY, start, end, 'WITHSCORES');

    if (results.length === 0) {
      return contextFromGlobalDb(userId, userRankInfo, surrounding);
    }

    const entries: AggregatedRow[] = [];
    for (let i = 0; i < results.length; i += 2) {
      const s = parseFloat(results[i + 1]);
      entries.push({ userId: results[i], score: s, bestScore: s, gamesPlayed: 0 });
    }
    const neighbors = await attachUsernames(entries, start + 1);
    const userRank = neighbors.find((n) => n.userId === userId) ?? null;
    if (!userRank) {
      return contextFromGlobalDb(userId, userRankInfo, surrounding);
    }
    return { userRank, neighbors };
  } catch {
    console.warn('[leaderboard] Redis unavailable, building user context from DB');
    return contextFromGlobalDb(userId, userRankInfo, surrounding);
  }
}

async function contextFromGlobalDb(
  userId: string,
  userRankInfo: { rank: number | null; score: number | null },
  surrounding: number
): Promise<{ userRank: LeaderboardEntry | null; neighbors: LeaderboardEntry[] }> {
  const rank = userRankInfo.rank!;
  const score = userRankInfo.score!;
  const start = Math.max(1, rank - surrounding);
  const end = rank + surrounding;
  const take = end - start + 1;
  const skip = start - 1;

  const users = await prisma.user.findMany({
    where: { highScore: { gt: 0 } },
    orderBy: [{ highScore: 'desc' }, { id: 'asc' }],
    skip,
    take,
    select: { id: true, username: true, highScore: true, gamesPlayed: true },
  });

  if (users.length === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, gamesPlayed: true },
    });
    const userRank: LeaderboardEntry = {
      rank,
      userId,
      username: user?.username || 'Usuario desconocido',
      score,
      bestScore: score,
      gamesPlayed: user?.gamesPlayed ?? 0,
    };
    return { userRank, neighbors: [userRank] };
  }

  const neighbors: LeaderboardEntry[] = users.map((u, i) => ({
    rank: start + i,
    userId: u.id,
    username: u.username,
    score: u.highScore,
    bestScore: u.highScore,
    gamesPlayed: u.gamesPlayed,
  }));
  const userRank = neighbors.find((n) => n.userId === userId) ?? null;
  if (userRank) return { userRank, neighbors };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, gamesPlayed: true },
  });
  const synthetic: LeaderboardEntry = {
    rank,
    userId,
    username: user?.username || 'Usuario desconocido',
    score,
    bestScore: score,
    gamesPlayed: user?.gamesPlayed ?? 0,
  };
  return { userRank: synthetic, neighbors: [...neighbors, synthetic] };
}

// --- Sync / rebuild operations (retroactive) ---

export async function syncLeaderboardFromDatabase(): Promise<number> {
  try {
    const redis = getRedis();
    const users = await prisma.user.findMany({
      where: { highScore: { gt: 0 } },
      select: { id: true, highScore: true },
      orderBy: { highScore: 'desc' },
    });

    await redis.del(LEADERBOARD_KEY);
    if (users.length === 0) return 0;

    const pipeline = redis.pipeline();
    for (const user of users) {
      pipeline.zadd(LEADERBOARD_KEY, user.highScore, user.id);
    }
    await pipeline.exec();
    return users.length;
  } catch (err) {
    console.error('[leaderboard] syncLeaderboardFromDatabase failed:', err);
    return 0;
  }
}

/**
 * Legacy: kept for the admin rebuild endpoint. Writes MAX score per user into
 * the Redis season ZSET. Reads no longer consult this — kept so manual rebuilds
 * remain backwards compatible.
 */
export async function syncSeasonLeaderboardFromDatabase(
  seasonId: string = getCurrentSeasonId()
): Promise<number> {
  try {
    const redis = getRedis();
    const seasonKey = getSeasonLeaderboardKey(seasonId);
    const { startDate, endDate } = seasonRange(seasonId);
    const rows = await prisma.gameResult.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: startDate, lt: endDate } },
      _max: { score: true },
    });
    const aggregates = rows
      .filter((r) => typeof r._max.score === 'number' && (r._max.score as number) > 0)
      .map((r) => ({ userId: r.userId, score: r._max.score as number }));

    await redis.del(seasonKey);
    if (aggregates.length === 0) return 0;

    const pipeline = redis.pipeline();
    for (const a of aggregates) {
      pipeline.zadd(seasonKey, a.score, a.userId);
    }
    await pipeline.exec();
    return aggregates.length;
  } catch (err) {
    console.error(`[leaderboard] syncSeasonLeaderboardFromDatabase(${seasonId}) failed:`, err);
    return 0;
  }
}

export async function recomputeAllHighScoresFromHistory(): Promise<{
  scanned: number;
  updated: number;
}> {
  const grouped = await prisma.gameResult.groupBy({
    by: ['userId'],
    _max: { score: true },
  });

  let updated = 0;
  for (const row of grouped) {
    const max = row._max.score ?? 0;
    if (max <= 0) continue;
    const result = await prisma.user.updateMany({
      where: { id: row.userId, highScore: { lt: max } },
      data: { highScore: max },
    });
    if (result.count > 0) updated += result.count;
  }

  return { scanned: grouped.length, updated };
}

export async function listSeasonsWithActivity(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ season: string }[]>`
    SELECT DISTINCT TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM') AS season
    FROM game_results
    ORDER BY season ASC
  `;
  return rows.map((r) => r.season);
}

export async function rebuildAllLeaderboards(): Promise<{
  highScoresUpdated: number;
  globalLoaded: number;
  seasonsLoaded: { seasonId: string; loaded: number }[];
}> {
  const highScores = await recomputeAllHighScoresFromHistory();
  const globalLoaded = await syncLeaderboardFromDatabase();
  const seasons = await listSeasonsWithActivity();
  const seasonsLoaded = await Promise.all(
    seasons.map(async (seasonId) => ({
      seasonId,
      loaded: await syncSeasonLeaderboardFromDatabase(seasonId),
    }))
  );
  return { highScoresUpdated: highScores.updated, globalLoaded, seasonsLoaded };
}
