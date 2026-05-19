import { getRedis } from '../config/redis.js';
import { prisma } from '../config/database.js';

const LEADERBOARD_KEY = 'leaderboard:global';
const SEASON_LEADERBOARD_KEY_PREFIX = 'leaderboard:season';

export type LeaderboardScope = 'global' | 'season';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
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

async function attachUsernames(
  entries: { userId: string; score: number }[],
  baseRank: number
): Promise<LeaderboardEntry[]> {
  if (entries.length === 0) return [];
  const userIds = entries.map((e) => e.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.username]));
  // Filtra entradas huérfanas (userId en Redis sin User en DB) y recalcula ranks
  // densamente. Sin esto, un Redis con userIds obsoletos mostraría filas
  // "Usuario desconocido" en el podio.
  const resolved: LeaderboardEntry[] = [];
  for (const entry of entries) {
    const username = userMap.get(entry.userId);
    if (!username) continue;
    resolved.push({
      rank: baseRank + resolved.length,
      userId: entry.userId,
      username,
      score: entry.score,
    });
  }
  return resolved;
}

// --- Postgres fallbacks (used when Redis is unavailable) ---

async function getTopGlobalFromDb(count: number): Promise<LeaderboardEntry[]> {
  const users = await prisma.user.findMany({
    where: { highScore: { gt: 0 } },
    orderBy: [{ highScore: 'desc' }, { id: 'asc' }],
    take: count,
    select: { id: true, username: true, highScore: true },
  });
  return users.map((u, i) => ({
    rank: i + 1,
    userId: u.id,
    username: u.username,
    score: u.highScore,
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

async function getSeasonAggregatesFromDb(
  seasonId: string,
  count?: number
): Promise<{ userId: string; score: number }[]> {
  const { startDate, endDate } = seasonRange(seasonId);
  const results = await prisma.gameResult.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: startDate, lt: endDate } },
    _max: { score: true },
    orderBy: { _max: { score: 'desc' } },
    ...(count ? { take: count } : {}),
  });
  return results
    .filter((r) => typeof r._max.score === 'number' && (r._max.score as number) > 0)
    .map((r) => ({ userId: r.userId, score: r._max.score as number }));
}

async function getTopSeasonFromDb(
  count: number,
  seasonId: string
): Promise<LeaderboardEntry[]> {
  const aggregates = await getSeasonAggregatesFromDb(seasonId, count);
  return attachUsernames(aggregates, 1);
}

async function getSeasonUserRankFromDb(
  userId: string,
  seasonId: string
): Promise<{ rank: number | null; score: number | null } | null> {
  const { startDate, endDate } = seasonRange(seasonId);
  const userMax = await prisma.gameResult.aggregate({
    where: { userId, createdAt: { gte: startDate, lt: endDate } },
    _max: { score: true },
  });
  const score = userMax._max.score;
  if (score === null || score === undefined || score <= 0) return null;
  const aggregates = await getSeasonAggregatesFromDb(seasonId);
  const usersAbove = aggregates.filter((a) => a.score > score).length;
  return { rank: usersAbove + 1, score };
}

async function getSeasonStatsFromDb(seasonId: string): Promise<LeaderboardStats> {
  const aggregates = await getSeasonAggregatesFromDb(seasonId);
  if (aggregates.length === 0) {
    return { totalPlayers: 0, topScore: null, avgScore: null };
  }
  const total = aggregates.length;
  const top = aggregates[0].score;
  const sum = aggregates.reduce((s, a) => s + a.score, 0);
  return { totalPlayers: total, topScore: top, avgScore: sum / total };
}

// --- Write operations (idempotent: only write if higher) ---

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

// --- Read operations (Redis primary, Postgres fallback) ---

export async function getTopLeaderboard(count: number = 50): Promise<LeaderboardEntry[]> {
  const clamped = Math.min(Math.max(count, 1), 500);
  try {
    const redis = getRedis();
    const results = await redis.zrevrange(LEADERBOARD_KEY, 0, clamped - 1, 'WITHSCORES');
    if (results.length === 0) {
      // Redis empty — fall back to DB (covers cold caches / Redis flushes).
      return getTopGlobalFromDb(clamped);
    }
    const entries: { userId: string; score: number }[] = [];
    for (let i = 0; i < results.length; i += 2) {
      entries.push({ userId: results[i], score: parseFloat(results[i + 1]) });
    }
    return attachUsernames(entries, 1);
  } catch {
    console.warn('[leaderboard] Redis unavailable, falling back to DB for global leaderboard');
    return getTopGlobalFromDb(clamped);
  }
}

export async function getSeasonLeaderboard(
  count: number = 50,
  seasonId: string = getCurrentSeasonId()
): Promise<LeaderboardEntry[]> {
  const clamped = Math.min(Math.max(count, 1), 500);
  try {
    const redis = getRedis();
    const seasonKey = getSeasonLeaderboardKey(seasonId);
    const results = await redis.zrevrange(seasonKey, 0, clamped - 1, 'WITHSCORES');
    if (results.length === 0) {
      return getTopSeasonFromDb(clamped, seasonId);
    }
    const entries: { userId: string; score: number }[] = [];
    for (let i = 0; i < results.length; i += 2) {
      entries.push({ userId: results[i], score: parseFloat(results[i + 1]) });
    }
    return attachUsernames(entries, 1);
  } catch {
    console.warn('[leaderboard] Redis unavailable, falling back to DB for season leaderboard');
    return getTopSeasonFromDb(clamped, seasonId);
  }
}

export async function getUserRank(
  userId: string
): Promise<{ rank: number | null; score: number | null } | null> {
  try {
    const redis = getRedis();
    const rank = await redis.zrevrank(LEADERBOARD_KEY, userId);
    const score = await redis.zscore(LEADERBOARD_KEY, userId);
    if (rank === null || score === null) {
      // Not in Redis — check DB to be sure (handles cold cache).
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
  seasonId: string = getCurrentSeasonId()
): Promise<{ rank: number | null; score: number | null } | null> {
  try {
    const redis = getRedis();
    const seasonKey = getSeasonLeaderboardKey(seasonId);
    const rank = await redis.zrevrank(seasonKey, userId);
    const score = await redis.zscore(seasonKey, userId);
    if (rank === null || score === null) {
      return getSeasonUserRankFromDb(userId, seasonId);
    }
    return { rank: rank + 1, score: parseFloat(score) };
  } catch {
    console.warn('[leaderboard] Redis unavailable, falling back to DB for season user rank');
    return getSeasonUserRankFromDb(userId, seasonId);
  }
}

export async function getLeaderboardStats(): Promise<LeaderboardStats> {
  try {
    const redis = getRedis();
    const totalPlayers = await redis.zcard(LEADERBOARD_KEY);
    if (totalPlayers === 0) {
      return getGlobalStatsFromDb();
    }
    const topResults = await redis.zrevrange(LEADERBOARD_KEY, 0, 0, 'WITHSCORES');
    const allScores = await redis.zrevrange(LEADERBOARD_KEY, 0, -1, 'WITHSCORES');
    let avgScore: number | null = null;
    if (totalPlayers > 0 && allScores.length > 0) {
      let sum = 0;
      for (let i = 1; i < allScores.length; i += 2) {
        sum += parseFloat(allScores[i]);
      }
      avgScore = sum / totalPlayers;
    }
    return {
      totalPlayers,
      topScore: topResults.length >= 2 ? parseFloat(topResults[1]) : null,
      avgScore,
    };
  } catch {
    console.warn('[leaderboard] Redis unavailable, falling back to DB for stats');
    return getGlobalStatsFromDb();
  }
}

export async function getSeasonLeaderboardStats(
  seasonId: string = getCurrentSeasonId()
): Promise<LeaderboardStats> {
  try {
    const redis = getRedis();
    const seasonKey = getSeasonLeaderboardKey(seasonId);
    const totalPlayers = await redis.zcard(seasonKey);
    if (totalPlayers === 0) {
      return getSeasonStatsFromDb(seasonId);
    }
    const topResults = await redis.zrevrange(seasonKey, 0, 0, 'WITHSCORES');
    const allScores = await redis.zrevrange(seasonKey, 0, -1, 'WITHSCORES');
    let avgScore: number | null = null;
    if (totalPlayers > 0 && allScores.length > 0) {
      let sum = 0;
      for (let i = 1; i < allScores.length; i += 2) {
        sum += parseFloat(allScores[i]);
      }
      avgScore = sum / totalPlayers;
    }
    return {
      totalPlayers,
      topScore: topResults.length >= 2 ? parseFloat(topResults[1]) : null,
      avgScore,
    };
  } catch {
    console.warn('[leaderboard] Redis unavailable, falling back to DB for season stats');
    return getSeasonStatsFromDb(seasonId);
  }
}

/**
 * Devuelve el contexto del leaderboard alrededor de un usuario (vecinos arriba/abajo).
 * Cae a Postgres si Redis no está disponible.
 */
export async function getUserLeaderboardContext(
  userId: string,
  surrounding: number = 3,
  scope: LeaderboardScope = 'global'
): Promise<{ userRank: LeaderboardEntry | null; neighbors: LeaderboardEntry[] }> {
  const userRankInfo =
    scope === 'season' ? await getSeasonUserRank(userId) : await getUserRank(userId);

  if (!userRankInfo || userRankInfo.rank === null || userRankInfo.score === null) {
    return { userRank: null, neighbors: [] };
  }

  try {
    const redis = getRedis();
    const key = scope === 'season' ? getSeasonLeaderboardKey(getCurrentSeasonId()) : LEADERBOARD_KEY;
    const rank = userRankInfo.rank;
    const start = Math.max(0, rank - 1 - surrounding);
    const end = rank - 1 + surrounding;
    const results = await redis.zrevrange(key, start, end, 'WITHSCORES');

    if (results.length === 0) {
      // Redis vacío: armar contexto desde DB.
      return contextFromDb(userId, userRankInfo, surrounding, scope);
    }

    const entries: { userId: string; score: number }[] = [];
    for (let i = 0; i < results.length; i += 2) {
      entries.push({ userId: results[i], score: parseFloat(results[i + 1]) });
    }
    const neighbors = await attachUsernames(entries, start + 1);
    const userRank = neighbors.find((n) => n.userId === userId) ?? null;
    if (!userRank) {
      // Edge case: el usuario salió del rango exacto, devolver contexto desde DB
      return contextFromDb(userId, userRankInfo, surrounding, scope);
    }
    return { userRank, neighbors };
  } catch {
    console.warn('[leaderboard] Redis unavailable, building user context from DB');
    return contextFromDb(userId, userRankInfo, surrounding, scope);
  }
}

async function contextFromDb(
  userId: string,
  userRankInfo: { rank: number | null; score: number | null },
  surrounding: number,
  scope: LeaderboardScope
): Promise<{ userRank: LeaderboardEntry | null; neighbors: LeaderboardEntry[] }> {
  const rank = userRankInfo.rank!;
  const score = userRankInfo.score!;
  const start = Math.max(1, rank - surrounding);
  const end = rank + surrounding;
  const take = end - start + 1;
  const skip = start - 1;

  const aggregates: { userId: string; score: number }[] =
    scope === 'season'
      ? (await getSeasonAggregatesFromDb(getCurrentSeasonId())).slice(skip, skip + take)
      : (
          await prisma.user.findMany({
            where: { highScore: { gt: 0 } },
            orderBy: [{ highScore: 'desc' }, { id: 'asc' }],
            skip,
            take,
            select: { id: true, highScore: true },
          })
        ).map((u) => ({ userId: u.id, score: u.highScore }));

  if (aggregates.length === 0) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
    const userRank: LeaderboardEntry = {
      rank,
      userId,
      username: user?.username || 'Usuario desconocido',
      score,
    };
    return { userRank, neighbors: [userRank] };
  }

  const neighbors = await attachUsernames(aggregates, start);
  const userRank = neighbors.find((n) => n.userId === userId) ?? null;
  if (userRank) return { userRank, neighbors };

  // Insert manualmente al usuario si no salió en la página
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  const synthetic: LeaderboardEntry = {
    rank,
    userId,
    username: user?.username || 'Usuario desconocido',
    score,
  };
  return { userRank: synthetic, neighbors: [...neighbors, synthetic] };
}

// --- Sync / rebuild operations (retroactive) ---

/**
 * Reconstruye el leaderboard global en Redis desde la fuente de verdad (User.highScore).
 * Sin tope de usuarios: deja Redis idéntico a la DB.
 */
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
 * Reconstruye el leaderboard de una temporada (mes YYYY-MM) usando los GameResult del período.
 * Útil para sincronizar después de un Redis flush o cambios masivos en DB.
 */
export async function syncSeasonLeaderboardFromDatabase(
  seasonId: string = getCurrentSeasonId()
): Promise<number> {
  try {
    const redis = getRedis();
    const seasonKey = getSeasonLeaderboardKey(seasonId);
    const aggregates = await getSeasonAggregatesFromDb(seasonId);

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

/**
 * Recomputa User.highScore desde GameResult para todos los usuarios.
 * Corrige inconsistencias retroactivas: si por bug histórico algún usuario tiene
 * highScore mal seteado, este job lo deja igual al máximo real de sus partidas.
 *
 * Devuelve el número de usuarios actualizados.
 */
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

/**
 * Lista todas las temporadas (YYYY-MM) que tienen al menos un GameResult registrado.
 */
export async function listSeasonsWithActivity(): Promise<string[]> {
  const dates = await prisma.gameResult.findMany({
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  const seasons = new Set<string>();
  for (const d of dates) {
    seasons.add(getCurrentSeasonId(d.createdAt));
  }
  return Array.from(seasons).sort();
}

/**
 * Rebuild retroactivo completo:
 *   1. Recomputa User.highScore desde GameResult (DB es la fuente de verdad).
 *   2. Resincroniza Redis global desde DB.
 *   3. Resincroniza Redis para cada temporada con actividad.
 */
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
