-- AlterEnum
ALTER TYPE "GameVariant" ADD VALUE 'PRACTICE';

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "countryCode" TEXT;

-- CreateTable
CREATE TABLE "mastery_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "difficulty" "Difficulty",
    "isCorrect" BOOLEAN NOT NULL,
    "gameMode" "GameMode" NOT NULL,
    "variant" "GameVariant" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mastery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mastery_attempts_userId_countryCode_category_occurredAt_idx" ON "mastery_attempts"("userId", "countryCode", "category", "occurredAt");

-- CreateIndex
CREATE INDEX "mastery_attempts_userId_occurredAt_idx" ON "mastery_attempts"("userId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "mastery_attempts_userId_runId_questionId_key" ON "mastery_attempts"("userId", "runId", "questionId");

-- CreateIndex
CREATE INDEX "questions_countryCode_category_isAvailable_idx" ON "questions"("countryCode", "category", "isAvailable");

-- AddForeignKey
ALTER TABLE "mastery_attempts" ADD CONSTRAINT "mastery_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

