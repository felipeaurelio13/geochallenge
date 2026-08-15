-- CreateEnum
CREATE TYPE "WorldEventRegion" AS ENUM ('AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA');

-- CreateEnum
CREATE TYPE "WorldEventBossAttemptStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- AlterEnum
ALTER TYPE "GameVariant" ADD VALUE 'EVENT_BOSS';

-- CreateTable
CREATE TABLE "world_event_plans" (
    "eventId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "region" "WorldEventRegion" NOT NULL,
    "questionIds" JSONB NOT NULL,
    "stops" JSONB NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "world_event_plans_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "world_event_boss_attempts" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "WorldEventBossAttemptStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "questionStartedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "world_event_boss_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_event_boss_answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "points" INTEGER NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "world_event_boss_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "world_event_plans_startsAt_idx" ON "world_event_plans"("startsAt");

-- CreateIndex
CREATE INDEX "world_event_boss_attempts_userId_eventId_startedAt_idx" ON "world_event_boss_attempts"("userId", "eventId", "startedAt");

-- CreateIndex
CREATE INDEX "world_event_boss_attempts_status_expiresAt_idx" ON "world_event_boss_attempts"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "world_event_boss_answers_attemptId_questionIndex_key" ON "world_event_boss_answers"("attemptId", "questionIndex");

-- CreateIndex
CREATE UNIQUE INDEX "world_event_boss_answers_attemptId_questionId_key" ON "world_event_boss_answers"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "world_event_boss_answers_attemptId_idx" ON "world_event_boss_answers"("attemptId");

-- AddForeignKey
ALTER TABLE "world_event_boss_attempts" ADD CONSTRAINT "world_event_boss_attempts_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "world_event_plans"("eventId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_event_boss_attempts" ADD CONSTRAINT "world_event_boss_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_event_boss_answers" ADD CONSTRAINT "world_event_boss_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "world_event_boss_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed boss achievements
INSERT INTO "achievements" ("id", "key", "nameEs", "nameEn", "descEs", "descEn", "icon") VALUES
('boss_first_achievement', 'BOSS_FIRST', 'Primer Guardián', 'First Guardian', 'Derrota por primera vez a un Guardián semanal', 'Defeat your first weekly Boss', 'boss-first'),
('boss_perfect_achievement', 'BOSS_PERFECT', 'Perfección Absoluta', 'Absolute Perfection', 'Obtén 10/10 en un Guardián semanal', 'Get 10/10 in a weekly Boss', 'boss-perfect')
ON CONFLICT ("key") DO NOTHING;
