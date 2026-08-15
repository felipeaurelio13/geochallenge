import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  achievementFindMany: vi.fn(),
  userAchievementFindMany: vi.fn(),
  userAchievementCreateMany: vi.fn(),
  gameResultCount: vi.fn(),
}));

vi.mock('../config/database.js', () => {
  const prisma = {
    achievement: { findMany: mocks.achievementFindMany },
    userAchievement: {
      findMany: mocks.userAchievementFindMany,
      createMany: mocks.userAchievementCreateMany,
    },
    gameResult: { count: mocks.gameResultCount },
  };
  return { prisma };
});

import {
  evaluateAchievementsAfterBoss,
  evaluateAchievementsAfterGame,
  type AchievementKey,
} from '../services/achievement.service.js';

const ACHIEVEMENTS: Array<{ id: string; key: string }> = [
  { id: 'ach-first-game', key: 'FIRST_GAME' },
  { id: 'ach-streak-10', key: 'STREAK_10' },
  { id: 'ach-streak-25', key: 'STREAK_25' },
  { id: 'ach-streak-50', key: 'STREAK_50' },
  { id: 'ach-perfect', key: 'PERFECT_GAME' },
  { id: 'ach-high-1k', key: 'HIGH_SCORE_1K' },
  { id: 'ach-first-win', key: 'FIRST_WIN' },
  { id: 'ach-daily-first', key: 'DAILY_FIRST' },
  { id: 'ach-daily-7', key: 'DAILY_7' },
  { id: 'ach-daily-30', key: 'DAILY_30' },
  { id: 'ach-boss-first', key: 'BOSS_FIRST' },
  { id: 'ach-boss-perfect', key: 'BOSS_PERFECT' },
];

describe('Boss achievements — idempotency and grants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.achievementFindMany.mockResolvedValue(ACHIEVEMENTS);
    mocks.userAchievementFindMany.mockResolvedValue([]);
    mocks.userAchievementCreateMany.mockResolvedValue({ count: 0 });
    mocks.gameResultCount.mockResolvedValue(5);
  });

  it('grants BOSS_FIRST on first clear (correctCount >= 7)', async () => {
    const granted = await evaluateAchievementsAfterBoss('user-1', 7);
    expect(granted).toContain('BOSS_FIRST');
    expect(mocks.userAchievementCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: 'user-1', achievementId: 'ach-boss-first' }),
        ]),
      }),
    );
  });

  it('does NOT grant BOSS_FIRST on a fail (< 7)', async () => {
    const granted = await evaluateAchievementsAfterBoss('user-1', 6);
    expect(granted).not.toContain('BOSS_FIRST');
    expect(granted).not.toContain('BOSS_PERFECT');
  });

  it('grants BOSS_PERFECT only on 10/10', async () => {
    const granted = await evaluateAchievementsAfterBoss('user-1', 10);
    expect(granted).toEqual(['BOSS_FIRST', 'BOSS_PERFECT']);
  });

  it('grants BOSS_FIRST exactly once (idempotent retry)', async () => {
    // First call: nothing earned yet -> granted
    const first = await evaluateAchievementsAfterBoss('user-1', 8);
    expect(first).toContain('BOSS_FIRST');

    // Retry after persistence: user now has BOSS_FIRST -> no duplicate grant
    mocks.userAchievementFindMany.mockResolvedValue([{ achievementId: 'ach-boss-first' }]);
    const second = await evaluateAchievementsAfterBoss('user-1', 8);
    expect(second).not.toContain('BOSS_FIRST');
    // createMany was only called once across the two invocations
    expect(mocks.userAchievementCreateMany).toHaveBeenCalledTimes(1);
  });

  it('10/10 perfect retry does not duplicate BOSS_PERFECT', async () => {
    const first = await evaluateAchievementsAfterBoss('user-1', 10);
    expect(first).toEqual(['BOSS_FIRST', 'BOSS_PERFECT']);

    mocks.userAchievementFindMany.mockResolvedValue([
      { achievementId: 'ach-boss-first' },
      { achievementId: 'ach-boss-perfect' },
    ]);
    const second = await evaluateAchievementsAfterBoss('user-1', 10);
    expect(second).toEqual([]);
    expect(mocks.userAchievementCreateMany).toHaveBeenCalledTimes(1);
  });

  it('does not affect the existing 10 achievements when granting boss ones', async () => {
    await evaluateAchievementsAfterBoss('user-1', 10);
    const call = mocks.userAchievementCreateMany.mock.calls[0][0] as { data: Array<{ achievementId: string }> };
    const ids = call.data.map((d) => d.achievementId);
    expect(ids).toEqual(['ach-boss-first', 'ach-boss-perfect']);
    expect(ids).not.toContain('ach-first-game');
  });

  it('evaluateAchievementsAfterGame also covers boss runs for general achievements', async () => {
    mocks.gameResultCount.mockResolvedValue(1); // FIRST_GAME
    const granted = await evaluateAchievementsAfterGame({
      userId: 'user-1',
      correctCount: 10,
      totalQuestions: 10,
      score: 1000,
    });
    expect(granted).toEqual(
      expect.arrayContaining<AchievementKey>(['FIRST_GAME', 'PERFECT_GAME', 'HIGH_SCORE_1K']),
    );
  });
});