ALTER TABLE "game_results" ADD COLUMN "runId" TEXT;
CREATE UNIQUE INDEX "game_results_runId_key" ON "game_results"("runId");
