-- CreateTable
CREATE TABLE "daily_challenge_plans" (
    "dayKey" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "questionIds" JSONB NOT NULL,
    "stops" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_challenge_plans_pkey" PRIMARY KEY ("dayKey")
);
