-- CreateEnum
CREATE TYPE "TelemetrySource" AS ENUM ('SERVER', 'CLIENT');

-- CreateTable
CREATE TABLE "telemetry_events" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" "TelemetrySource" NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT,
    "clientSessionId" TEXT,
    "runId" TEXT,
    "gameResultId" TEXT,
    "gameMode" "GameMode",
    "variant" "GameVariant",
    "category" "Category",
    "questionId" TEXT,
    "properties" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telemetry_events_eventKey_key" ON "telemetry_events"("eventKey");

-- CreateIndex
CREATE INDEX "telemetry_events_name_occurredAt_idx" ON "telemetry_events"("name", "occurredAt");

-- CreateIndex
CREATE INDEX "telemetry_events_userId_occurredAt_idx" ON "telemetry_events"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "telemetry_events_variant_occurredAt_idx" ON "telemetry_events"("variant", "occurredAt");

-- CreateIndex
CREATE INDEX "telemetry_events_gameMode_occurredAt_idx" ON "telemetry_events"("gameMode", "occurredAt");

-- CreateIndex
CREATE INDEX "telemetry_events_runId_idx" ON "telemetry_events"("runId");

-- AddForeignKey
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
