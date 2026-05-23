-- AlterEnum
ALTER TYPE "Category" ADD VALUE 'MOVIE_SCENE';

-- AlterTable
ALTER TABLE "challenges" ALTER COLUMN "categories" DROP DEFAULT,
ALTER COLUMN "maxPlayers" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "challenges_status_expiresAt_idx" ON "challenges"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "challenges_creatorId_idx" ON "challenges"("creatorId");

-- CreateIndex
CREATE INDEX "game_results_userId_createdAt_idx" ON "game_results"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "questions_category_idx" ON "questions"("category");

-- CreateIndex
CREATE INDEX "questions_isAvailable_idx" ON "questions"("isAvailable");
