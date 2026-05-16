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

async function getAchievementId(key: string): Promise<string | null> {
  const ach = await prisma.achievement.findUnique({ where: { key }, select: { id: true } });
  return ach?.id ?? null;
}

async function alreadyEarned(userId: string, achievementId: string): Promise<boolean> {
  const existing = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId } },
  });
  return !!existing;
}

async function grantIfNew(
  userId: string,
  key: string,
  meta?: Record<string, unknown>
): Promise<boolean> {
  const achievementId = await getAchievementId(key);
  if (!achievementId) return false;
  if (await alreadyEarned(userId, achievementId)) return false;

  await prisma.userAchievement.create({
    data: { userId, achievementId, meta: meta ?? undefined },
  });
  return true;
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
  const earned: AchievementKey[] = [];

  const tryGrant = async (key: AchievementKey, meta?: Record<string, unknown>) => {
    const granted = await grantIfNew(ctx.userId, key, meta);
    if (granted) earned.push(key);
  };

  // First game ever
  const gameCount = await prisma.gameResult.count({ where: { userId: ctx.userId } });
  if (gameCount <= 1) await tryGrant('FIRST_GAME');

  // Perfect game
  if (ctx.correctCount === ctx.totalQuestions && ctx.totalQuestions >= 5) {
    await tryGrant('PERFECT_GAME');
  }

  // High score 1000+
  if (ctx.score >= 1000) await tryGrant('HIGH_SCORE_1K', { score: ctx.score });

  // Streak milestones
  if (ctx.isStreakMode && ctx.streakLength !== undefined) {
    if (ctx.streakLength >= 10) await tryGrant('STREAK_10', { streak: ctx.streakLength });
    if (ctx.streakLength >= 25) await tryGrant('STREAK_25', { streak: ctx.streakLength });
    if (ctx.streakLength >= 50) await tryGrant('STREAK_50', { streak: ctx.streakLength });
  }

  // Duel win
  if (ctx.isDuel && ctx.isWin) await tryGrant('FIRST_WIN');

  return earned;
}

export async function evaluateAchievementsAfterDaily(
  userId: string,
  dailyStreak: number
): Promise<AchievementKey[]> {
  const earned: AchievementKey[] = [];

  const tryGrant = async (key: AchievementKey, meta?: Record<string, unknown>) => {
    const granted = await grantIfNew(userId, key, meta);
    if (granted) earned.push(key);
  };

  if (dailyStreak >= 1) await tryGrant('DAILY_FIRST');
  if (dailyStreak >= 7) await tryGrant('DAILY_7', { streak: dailyStreak });
  if (dailyStreak >= 30) await tryGrant('DAILY_30', { streak: dailyStreak });

  return earned;
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
