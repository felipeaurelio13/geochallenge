import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';

export type AchievementKey =
  | 'FIRST_GAME'
  | 'STREAK_10'
  | 'STREAK_25'
  | 'STREAK_50'
  | 'PERFECT_GAME'
  | 'HIGH_SCORE_1K'
  | 'FIRST_WIN'
  | 'DAILY_FIRST'
  | 'DAILY_7'
  | 'DAILY_30';

export interface EarnedAchievement {
  key: string;
  nameEs: string;
  nameEn: string;
  descEs: string;
  descEn: string;
  icon: string;
  earnedAt: Date;
  meta?: Record<string, unknown> | null;
}

// Achievement table has exactly 10 fixed rows seeded in the migration; never changes at runtime.
// Cache key→id mapping once per process lifetime to avoid re-querying on every game finish.
const achievementIdCache = new Map<string, string>();

async function ensureCache(): Promise<void> {
  if (achievementIdCache.size > 0) return;
  const rows = await prisma.achievement.findMany({ select: { id: true, key: true } });
  for (const r of rows) achievementIdCache.set(r.key, r.id);
}

export interface GameCompletedContext {
  userId: string;
  correctCount: number;
  totalQuestions: number;
  score: number;
  streakLength?: number;
  isStreakMode?: boolean;
  isDuel?: boolean;
  isWin?: boolean;
}

export async function evaluateAchievementsAfterGame(
  ctx: GameCompletedContext
): Promise<AchievementKey[]> {
  await ensureCache();

  const [gameCount, earnedRows] = await Promise.all([
    prisma.gameResult.count({ where: { userId: ctx.userId } }),
    prisma.userAchievement.findMany({
      where: { userId: ctx.userId },
      select: { achievementId: true },
    }),
  ]);

  const earnedSet = new Set(earnedRows.map((r) => r.achievementId));

  const candidates: { key: AchievementKey; meta?: Record<string, unknown> }[] = [];

  if (gameCount <= 1) candidates.push({ key: 'FIRST_GAME' });

  if (ctx.correctCount === ctx.totalQuestions && ctx.totalQuestions >= 5) {
    candidates.push({ key: 'PERFECT_GAME' });
  }

  if (ctx.score >= 1000) candidates.push({ key: 'HIGH_SCORE_1K', meta: { score: ctx.score } });

  if (ctx.isStreakMode && ctx.streakLength !== undefined) {
    if (ctx.streakLength >= 10) candidates.push({ key: 'STREAK_10', meta: { streak: ctx.streakLength } });
    if (ctx.streakLength >= 25) candidates.push({ key: 'STREAK_25', meta: { streak: ctx.streakLength } });
    if (ctx.streakLength >= 50) candidates.push({ key: 'STREAK_50', meta: { streak: ctx.streakLength } });
  }

  if (ctx.isDuel && ctx.isWin) candidates.push({ key: 'FIRST_WIN' });

  return grantNewAchievements(ctx.userId, candidates, earnedSet);
}

export async function evaluateAchievementsAfterDaily(
  userId: string,
  dailyStreak: number
): Promise<AchievementKey[]> {
  await ensureCache();

  const earnedRows = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true },
  });
  const earnedSet = new Set(earnedRows.map((r) => r.achievementId));

  const candidates: { key: AchievementKey; meta?: Record<string, unknown> }[] = [];
  if (dailyStreak >= 1) candidates.push({ key: 'DAILY_FIRST' });
  if (dailyStreak >= 7) candidates.push({ key: 'DAILY_7', meta: { streak: dailyStreak } });
  if (dailyStreak >= 30) candidates.push({ key: 'DAILY_30', meta: { streak: dailyStreak } });

  return grantNewAchievements(userId, candidates, earnedSet);
}

async function grantNewAchievements(
  userId: string,
  candidates: { key: AchievementKey; meta?: Record<string, unknown> }[],
  earnedSet: Set<string>
): Promise<AchievementKey[]> {
  const newGrants = candidates.filter((c) => {
    const achievementId = achievementIdCache.get(c.key);
    return achievementId !== undefined && !earnedSet.has(achievementId);
  });

  if (newGrants.length === 0) return [];

  await prisma.userAchievement.createMany({
    data: newGrants.map((c) => ({
      userId,
      achievementId: achievementIdCache.get(c.key)!,
      ...(c.meta ? { meta: c.meta as Prisma.InputJsonValue } : {}),
    })),
    skipDuplicates: true,
  });

  return newGrants.map((c) => c.key);
}

export async function getUserAchievements(userId: string): Promise<EarnedAchievement[]> {
  const rows = await prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
    orderBy: { earnedAt: 'asc' },
  });

  return rows.map((r) => ({
    key: r.achievement.key,
    nameEs: r.achievement.nameEs,
    nameEn: r.achievement.nameEn,
    descEs: r.achievement.descEs,
    descEn: r.achievement.descEn,
    icon: r.achievement.icon,
    earnedAt: r.earnedAt,
    meta: r.meta as Record<string, unknown> | null,
  }));
}
