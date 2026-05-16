-- Add daily streak tracking to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dailyStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastDailyDate" TEXT;

-- Create achievements catalog table
CREATE TABLE IF NOT EXISTS "achievements" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameEs" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descEs" TEXT NOT NULL,
    "descEn" TEXT NOT NULL,
    "icon" TEXT NOT NULL,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "achievements_key_key" ON "achievements"("key");

-- Create user_achievements join table
CREATE TABLE IF NOT EXISTS "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_achievements_userId_achievementId_key"
    ON "user_achievements"("userId", "achievementId");

ALTER TABLE "user_achievements"
    ADD CONSTRAINT "user_achievements_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_achievements"
    ADD CONSTRAINT "user_achievements_achievementId_fkey"
    FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed base achievements
INSERT INTO "achievements" ("id", "key", "nameEs", "nameEn", "descEs", "descEn", "icon") VALUES
  ('ach_first_game',    'FIRST_GAME',    'Primera partida',        'First Game',         'Jugaste tu primera partida',                    'Play your first game',                   '🎯'),
  ('ach_streak_10',     'STREAK_10',     'Racha de 10',            'Streak of 10',       'Respondiste 10 seguidas en modo racha',          'Answer 10 in a row in streak mode',      '🔥'),
  ('ach_streak_25',     'STREAK_25',     'Imparable',              'Unstoppable',        'Respondiste 25 seguidas en modo racha',          'Answer 25 in a row in streak mode',      '⚡'),
  ('ach_streak_50',     'STREAK_50',     'Geógrafo Elite',         'Elite Geographer',   'Respondiste 50 seguidas en modo racha',          'Answer 50 in a row in streak mode',      '🌍'),
  ('ach_perfect_game',  'PERFECT_GAME',  'Partida perfecta',       'Perfect Game',       'Respondiste todas correctamente en una partida', 'Answer all correctly in a single game',   '💯'),
  ('ach_high_1000',     'HIGH_SCORE_1K', 'Cuatro dígitos',         'Four Digits',        'Alcanzaste 1000 puntos o más',                  'Reach 1000 points or more',              '🏆'),
  ('ach_first_win',     'FIRST_WIN',     'Primera victoria',       'First Victory',      'Ganaste tu primer duelo',                       'Win your first duel',                    '⚔️'),
  ('ach_daily_first',   'DAILY_FIRST',   'Reto del día',           'Daily Challenge',    'Completaste tu primer reto del día',             'Complete your first daily challenge',     '📅'),
  ('ach_daily_7',       'DAILY_7',       'Semana de racha',        'Week Streak',        'Completaste el reto del día 7 días seguidos',    'Complete the daily 7 days in a row',      '🗓️'),
  ('ach_daily_30',      'DAILY_30',      'Mes completo',           'Full Month',         'Completaste el reto del día 30 días seguidos',   'Complete the daily 30 days in a row',     '🏅')
ON CONFLICT ("key") DO NOTHING;
