-- Add SURVIVAL to GameMode enum
ALTER TYPE "GameMode" ADD VALUE IF NOT EXISTS 'SURVIVAL';

-- Create survival_matches table
CREATE TABLE IF NOT EXISTS "survival_matches" (
    "id" TEXT NOT NULL,
    "category" "Category",
    "totalRounds" INTEGER NOT NULL,
    "peakPlayers" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survival_matches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "survival_matches_createdAt_idx" ON "survival_matches"("createdAt");

-- Create survival_participants table
CREATE TABLE IF NOT EXISTS "survival_participants" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "finalRank" INTEGER NOT NULL,
    "eliminatedRound" INTEGER,
    "finalScore" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "livesEarned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "survival_participants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "survival_participants_userId_idx" ON "survival_participants"("userId");
CREATE INDEX IF NOT EXISTS "survival_participants_matchId_idx" ON "survival_participants"("matchId");

-- Add foreign key constraints
ALTER TABLE "survival_participants"
    ADD CONSTRAINT "survival_participants_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "survival_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "survival_participants"
    ADD CONSTRAINT "survival_participants_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
