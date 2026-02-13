import { getRedis } from '../config/redis.js';
import { prisma } from '../config/database.js';

const LEADERBOARD_KEY = 'leaderboard:global';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
}

/**
 * Actualiza el puntaje de un usuario en el leaderboard
 * Solo actualiza si el nuevo puntaje es mayor
 */
export async function updateLeaderboardScore(
  userId: string,
  score: number
): Promise<boolean> {
  const redis = getRedis();

  // Obtener puntaje actual
  const currentScore = await redis.zscore(LEADERBOARD_KEY, userId);

  // Solo actualizar si es mayor
  if (currentScore === null || score > parseFloat(currentScore)) {
    await redis.zadd(LEADERBOARD_KEY, score, userId);
    return true;
  }

  return false;
}

/**
 * Obtiene el top N del leaderboard
 */
export async function getTopLeaderboard(
  count: number = 50
): Promise<LeaderboardEntry[]> {
  const redis = getRedis();

  // Obtener IDs y scores del top N (orden descendente)
  const results = await redis.zrevrange(LEADERBOARD_KEY, 0, count - 1, 'WITHSCORES');

  if (results.length === 0) {
    return [];
  }

  // Parsear resultados (formato: [userId, score, userId, score, ...])
  const entries: { userId: string; score: number }[] = [];
  for (let i = 0; i < results.length; i += 2) {
    entries.push({
      userId: results[i],
      score: parseFloat(results[i + 1]),
    });
  }

  // Obtener usernames de la base de datos
  const userIds = entries.map((e) => e.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u.username]));

  // Construir respuesta con ranks
  return entries.map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    username: userMap.get(entry.userId) || 'Usuario desconocido',
    score: entry.score,
  }));
}

/**
 * Obtiene la posición de un usuario en el leaderboard
 */
export async function getUserRank(userId: string): Promise<{
  rank: number | null;
  score: number | null;
} | null> {
  const redis = getRedis();

  // ZREVRANK devuelve posición en orden descendente (0-indexed)
  const rank = await redis.zrevrank(LEADERBOARD_KEY, userId);
  const score = await redis.zscore(LEADERBOARD_KEY, userId);

  if (rank === null || score === null) {
    return null;
  }

  return {
    rank: rank + 1, // Convertir a 1-indexed
    score: parseFloat(score),
  };
}

/**
 * Obtiene el contexto del leaderboard para un usuario
 * (su posición + jugadores cercanos)
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

  const redis = getRedis();

  // Calcular rango de vecinos
  const start = Math.max(0, userRankInfo.rank - 1 - surrounding);
  const end = userRankInfo.rank - 1 + surrounding;

  const results = await redis.zrevrange(LEADERBOARD_KEY, start, end, 'WITHSCORES');

  // Parsear resultados
  const entries: { userId: string; score: number }[] = [];
  for (let i = 0; i < results.length; i += 2) {
    entries.push({
      userId: results[i],
      score: parseFloat(results[i + 1]),
    });
  }

  // Obtener usernames
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
}

/**
 * Sincroniza el leaderboard con la base de datos
 * (útil para inicializar o reparar)
 */
export async function syncLeaderboardFromDatabase(): Promise<number> {
  const redis = getRedis();

  // Obtener todos los usuarios con highScore > 0
  const users = await prisma.user.findMany({
    where: { highScore: { gt: 0 } },
    select: { id: true, highScore: true },
  });

  if (users.length === 0) {
    return 0;
  }

  // Limpiar leaderboard actual
  await redis.del(LEADERBOARD_KEY);

  // Agregar todos los usuarios
  const pipeline = redis.pipeline();
  for (const user of users) {
    pipeline.zadd(LEADERBOARD_KEY, user.highScore, user.id);
  }
  await pipeline.exec();

  return users.length;
}

/**
 * Obtiene estadísticas del leaderboard
 */
export async function getLeaderboardStats(): Promise<{
  totalPlayers: number;
  topScore: number | null;
}> {
  const redis = getRedis();

  const totalPlayers = await redis.zcard(LEADERBOARD_KEY);
  const topResults = await redis.zrevrange(LEADERBOARD_KEY, 0, 0, 'WITHSCORES');

  return {
    totalPlayers,
    topScore: topResults.length >= 2 ? parseFloat(topResults[1]) : null,
  };
}
