-- CreateTable
CREATE TABLE "challenge_participants" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER,
    "correctCount" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "challenge_participants_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "challenges"
ADD COLUMN "answerTimeSeconds" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "categories" "Category"[] DEFAULT ARRAY['MIXED']::"Category"[],
ADD COLUMN "creatorId" TEXT,
ADD COLUMN "maxPlayers" INTEGER NOT NULL DEFAULT 2;

UPDATE "challenges"
SET "creatorId" = "challengerId",
    "categories" = CASE
      WHEN "category" IS NULL THEN ARRAY['MIXED']::"Category"[]
      ELSE ARRAY["category"]::"Category"[]
    END;

INSERT INTO "challenge_participants" ("id", "challengeId", "userId", "score", "joinedAt", "completedAt")
SELECT concat('cp_', "id", '_1'), "id", "challengerId", "challengerScore", "createdAt", CASE WHEN "challengerScore" IS NULL THEN NULL ELSE "completedAt" END
FROM "challenges";

INSERT INTO "challenge_participants" ("id", "challengeId", "userId", "score", "joinedAt", "completedAt")
SELECT concat('cp_', "id", '_2'), "id", "challengedId", "challengedScore", "createdAt", CASE WHEN "challengedScore" IS NULL THEN NULL ELSE "completedAt" END
FROM "challenges";

ALTER TABLE "challenges"
ALTER COLUMN "creatorId" SET NOT NULL,
ALTER COLUMN "categories" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "challenges" DROP CONSTRAINT "challenges_challengedId_fkey";
ALTER TABLE "challenges" DROP CONSTRAINT "challenges_challengerId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "challenge_participants_challengeId_userId_key" ON "challenge_participants"("challengeId", "userId");

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old columns
ALTER TABLE "challenges"
DROP COLUMN "challengerId",
DROP COLUMN "challengedId",
DROP COLUMN "challengerScore",
DROP COLUMN "challengedScore",
DROP COLUMN "category";
