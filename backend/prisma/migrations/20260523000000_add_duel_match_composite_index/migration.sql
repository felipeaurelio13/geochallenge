-- CreateIndex
CREATE INDEX IF NOT EXISTS "duel_matches_player1Id_player2Id_idx" ON "duel_matches"("player1Id", "player2Id");
