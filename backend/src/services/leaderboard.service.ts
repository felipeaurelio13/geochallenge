import { getRedis } from '../config/redis.js';
import { prisma } from '../config/database.js';

const LEADERBOARD_KEY = 'leaderboard:global';
const SEASON_LEADERBOARD_KEY_PREFIX = 'leaderboard:season';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
}

function getCurrentSeasonId(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

function getSeasonLeaderboardKey(seasonId: string): string {
  return `${SEASON_LEADERBOARD_KEY_PREFIX}:${seasonId}`;
}

// --- Postgres fallbacks (used when Redis is unavailable) ---

async function getTopLeaderboardFromDb(count: number): Promise<LeaderboardEntry[]> {
  const users = await prisma.user.findMany({
    where: { highScore: { gt: 0 } },
    orderBy: { highScore: 'desc' },
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

async function getLeaderboardStatsFromDb(): Promise<{
  totalPlayers: number;
  topScore: number | null;
  avgScore: number | null;
}> {
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

async function getUserRankFromDb(userId: string): Promise<{
  rank: number | null;
  score: number | null;
} | null> {
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

// --- Write operations ---

/**
 * Actualiza el puntaje de un usuario en el leaderboard
 * Solo actualiza si el nuevo puntaje es mayor
 */
export async function updateLeaderboardScore(
  userId: string,
  score: number
): Promise<boolean> {
  const redis = getRedis();

  const currentScore = await redis.zscore(LEADERBOARD_KEY, userId);

  if (currentScore === null || score > parseFloat(currentScore)) {
    await redis.zadd(LEADERBOARD_KEY, score, userId);
    return true;
  }

  return false;
}

export async function updateSeasonLeaderboardScore(
  userId: string,
  score: number,
  seasonId: string = getCurrentSeasonId()
): Promise<boolean> {
  const redis = getRedis();
  const seasonKey = getSeasonLeaderboardKey(seasonId);
  const currentScore = await redis.zscore(seasonKey, userId);

  if (currentScore === null || score > parseFloat(currentScore)) {
    await redis.zadd(seasonKey, score, userId);
    return true;
  }

  return false;
}

// --- Read operations (with Postgres fallback for global, empty fallback for season) ---

/**
 * Obtiene el top N del leaderboard global.
 * Si Redis no está disponible, cae a Postgres.
 */
export async function getTopLeaderboard(
  count: number = 50
): Promise<LeaderboardEntry[]> {
  try {
    const redis = getRedis();
    const results = await redis.zrevrange(LEADERBOARD_KEY, 0, count - 1, 'WITHSCORES');

    if (results.length === 0) {
      return [];
    }

    const entries: { userId: string; score: number }[] = [];
    for (let i = 0; i < results.length; i += 2) {
      entries.push({ userId: results[i], score: parseFloat(results[i + 1]) });
    }

    const userIds = entries.map((e) => e.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u.username]));

    return entries.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      username: userMap.get(entry.userId) || 'Usuario desconocido',
      score: entry.score,
    }));
  } catch {
    console.warn('[leaderboard] Redis unavailable, falling back to DB for global leaderboard');
    return getTopLeaderboardFromDb(count);
  }
}

export async function getSeasonLeaderboard(
  count: number = 50,
  seasonId: string = getCurrentSeasonId()
): Promise<LeaderboardEntry[]> {
  try {
    const redis = getRedis();
    const seasonKey = getSeasonLeaderboardKey(seasonId);
    const results = await redis.zrevrange(seasonKey, 0, count - 1, 'WITHSCORES');

    if (results.length === 0) {
      return [];
    }

    const entries: { userId: string; score: number }[] = [];
    for (let i = 0; i < results.length; i += 2) {
      entries.push({ userId: results[i], score: parseFloat(results[i + 1]) });
    }

    const userIds = entries.map((e) => e.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u.username]));

    return entries.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      username: userMap.get(entry.userId) || 'Usuario desconocido',
      score: entry.score,
    }));
  } catch {
    console.warn('[leaderboard] Redis unavailable, season leaderboard not available');
    return [];
  }
}

/**
 * Obtiene la posición de un usuario en el leaderboard global.
 * Si Redis no está disponible, cae a Postgres.
 */
export async function getUserRank(userId: string): Promise<{
  rank: number | null;
  score: number | null;
} | null> {
  try {
    const redis = getRedis();
    const rank = await redis.zrevrank(LEADERBOARD_KEY, userId);
    const score = await redis.zscore(LEADERBOARD_KEY, userId);

    if (rank === null || score === null) {
      return null;
    }

    return { rank: rank + 1, score: parseFloat(score) };
  } catch {
    console.warn('[leaderboard] Redis unavailable, falling back to DB for user rank');
    return getUserRankFromDb(userId);
  }
}

export async function getSeasonUserRank(
  userId: string,
  seasonId: string = getCurrentSeasonId()
): Promise<{
  rank: number | null;
  score: number | null;
} | null> {
  try {
    const redis = getRedis();
    const seasonKey = getSeasonLeaderboardKey(seasonId);
    const rank = await redis.zrevrank(seasonKey, userId);
    const score = await redis.zscore(seasonKey, userId);

    if (rank === null || score === null) {
      return null;
    }

    return { rank: rank + 1, score: parseFloat(score) };
  } catch {
    console.warn('[leaderboard] Redis unavailable, season user rank not available');
    return null;
  }
}

export async function getSeasonLeaderboardStats(
  seasonId: string = getCurrentSeasonId()
): Promise<{
  totalPlayers: number;
  topScore: number | null;
  avgScore: number | null;
}> {
  try {
    const redis = getRedis();
    const seasonKey = getSeasonLeaderboardKey(seasonId);
    const totalPlayers = await redis.zcard(seasonKey);
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
    console.warn('[leaderboard] Redis unavailable, season stats not available');
    return { totalPlayers: 0, topScore: null, avgScore: null };
  }
}

/**
 * Obtiene el contexto del leaderboard para un usuario
 * (su posición + jugadores cercanos).
 * Si Redis no está disponible, devuelve solo la posición del usuario (sin vecinos).
 */
export async function getUserLeaderboardContext(
  userId: string,
  surrounding: number = 2
): Promise<{
  userRank: LeaderboardEntry | null;
  neighbors: LeaderboardEntry[];
}> {
  const userRankInfo = await getUserRank(userId);

  if (!userRankInfo) {
    return { userRank: null, neighbors: [] };
  }

  try {
    const redis = getRedis();
    const rank = userRankInfo.rank!;
    const start = Math.max(0, rank - 1 - surrounding);
    const end = rank - 1 + surrounding;

    const results = await redis.zrevrange(LEADERBOARD_KEY, start, end, 'WITHSCORES');

    const entries: { userId: string; score: number }[] = [];
    for (let i = 0; i < results.length; i += 2) {
      entries.push({ userId: results[i], score: parseFloat(results[i + 1]) });
    }

    const userIds = entries.map((e) => e.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u.username]));

    const neighbors = entries.map((entry, index) => ({
      rank: start + index + 1,
      userId: entry.userId,
      username: userMap.get(entry.userId) || 'Usuario desconocido',
      score: entry.score,
    }));

    const userRank = neighbors.find((n) => n.userId === userId) || null;

    return { userRank, neighbors };
  } catch {
    console.warn('[leaderboard] Redis unavailable, returning user rank without neighbors');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    const userRank: LeaderboardEntry = {
      rank: userRankInfo.rank!,
      userId,
      username: user?.username || 'Usuario desconocido',
      score: userRankInfo.score!,
    };
    return { userRank, neighbors: [userRank] };
  }
}

/**
 * Sincroniza el leaderboard global con la base de datos.
 * (útil para inicializar o reparar)
 */
export async function syncLeaderboardFromDatabase(): Promise<number> {
  const redis = getRedis();

  const users = await prisma.user.findMany({
    where: { highScore: { gt: 0 } },
    select: { id: true, highScore: true },
    orderBy: { highScore: 'desc' },
    take: 1000,
  });

  if (users.length === 0) {
    return 0;
  }

  await redis.del(LEADERBOARD_KEY);

  const pipeline = redis.pipeline();
  for (const user of users) {
    pipeline.zadd(LEADERBOARD_KEY, user.highScore, user.id);
  }
  await pipeline.exec();

  return users.length;
}

/**
 * Sincroniza el leaderboard de temporada con la base de datos.
 * Reconstruye el ranking de temporada desde game_results filtrados por mes.
 */
export async function syncSeasonLeaderboardFromDatabase(
  seasonId: string = getCurrentSeasonId()
): Promise<number> {
  const redis = getRedis();
  const seasonKey = getSeasonLeaderboardKey(seasonId);
  const [year, month] = seasonId.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const results = await prisma.gameResult.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: startDate, lt: endDate } },
    _max: { score: true },
    orderBy: { _max: { score: 'desc' } },
    take: 1000,
  });

  if (results.length === 0) {
    return 0;
  }

  await redis.del(seasonKey);

  const pipeline = redis.pipeline();
  for (const r of results) {
    if (r._max.score !== null) {
      pipeline.zadd(seasonKey, r._max.score, r.userId);
    }
  }
  await pipeline.exec();

  return results.length;
}

/**
 * Obtiene estadísticas del leaderboard global.
 * Si Redis no está disponible, cae a Postgres.
 */
export async function getLeaderboardStats(): Promise<{
  totalPlayers: number;
  topScore: number | null;
  avgScore: number | null;
}> {
  try {
    const redis = getRedis();
    const totalPlayers = await redis.zcard(LEADERBOARD_KEY);
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
    return getLeaderboardStatsFromDb();
  }
}
