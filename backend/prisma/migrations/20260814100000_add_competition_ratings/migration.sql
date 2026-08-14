-- CreateEnum
CREATE TYPE "CompetitiveLadder" AS ENUM ('CLASSIC', 'GEO_CHALLENGE');

-- CreateEnum
CREATE TYPE "CompetitiveOutcome" AS ENUM ('WIN', 'DRAW', 'LOSS');

-- CreateEnum
CREATE TYPE "DuelFinishReason" AS ENUM ('COMPLETED', 'OPPONENT_DISCONNECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "duel_matches" ADD COLUMN     "runId" TEXT,
ADD COLUMN     "rated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ladder" "CompetitiveLadder",
ADD COLUMN     "finishReason" "DuelFinishReason",
ADD COLUMN     "ratingVersion" INTEGER;

-- CreateTable
CREATE TABLE "competitive_ratings" (
    "userId" TEXT NOT NULL,
    "ladder" "CompetitiveLadder" NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "peakRating" INTEGER NOT NULL DEFAULT 1000,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "lastMatchAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitive_ratings_pkey" PRIMARY KEY ("userId","ladder")
);

-- CreateTable
CREATE TABLE "competitive_rating_changes" (
    "id" TEXT NOT NULL,
    "duelMatchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ladder" "CompetitiveLadder" NOT NULL,
    "outcome" "CompetitiveOutcome" NOT NULL,
    "ratingBefore" INTEGER NOT NULL,
    "ratingDelta" INTEGER NOT NULL,
    "ratingAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitive_rating_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "duel_matches_runId_key" ON "duel_matches"("runId");

-- CreateIndex
CREATE INDEX "competitive_ratings_ladder_rating_idx" ON "competitive_ratings"("ladder", "rating" DESC);

-- CreateIndex
CREATE INDEX "competitive_ratings_userId_updatedAt_idx" ON "competitive_ratings"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "competitive_rating_changes_duelMatchId_userId_key" ON "competitive_rating_changes"("duelMatchId", "userId");

-- CreateIndex
CREATE INDEX "competitive_rating_changes_userId_ladder_createdAt_idx" ON "competitive_rating_changes"("userId", "ladder", "createdAt");

-- CreateIndex
CREATE INDEX "competitive_rating_changes_ladder_createdAt_idx" ON "competitive_rating_changes"("ladder", "createdAt");

-- AddForeignKey
ALTER TABLE "competitive_ratings" ADD CONSTRAINT "competitive_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitive_rating_changes" ADD CONSTRAINT "competitive_rating_changes_duelMatchId_fkey" FOREIGN KEY ("duelMatchId") REFERENCES "duel_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitive_rating_changes" ADD CONSTRAINT "competitive_rating_changes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
