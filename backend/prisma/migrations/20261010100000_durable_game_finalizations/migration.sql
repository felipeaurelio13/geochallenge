-- CreateTable
CREATE TABLE "PendingGameFinalization" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PendingGameFinalization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingGameFinalization_runId_key" ON "PendingGameFinalization"("runId");

-- CreateIndex
CREATE INDEX "PendingGameFinalization_status_createdAt_idx" ON "PendingGameFinalization"("status", "createdAt");
