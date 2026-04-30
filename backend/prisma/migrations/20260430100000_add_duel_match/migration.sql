-- CreateTable
CREATE TABLE "duel_matches" (
    "id" TEXT NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT NOT NULL,
    "winnerId" TEXT,
    "player1Score" INTEGER NOT NULL,
    "player2Score" INTEGER NOT NULL,
    "category" "Category",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duel_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "duel_matches_player1Id_createdAt_idx" ON "duel_matches"("player1Id", "createdAt");

-- CreateIndex
CREATE INDEX "duel_matches_player2Id_createdAt_idx" ON "duel_matches"("player2Id", "createdAt");

-- AddForeignKey
ALTER TABLE "duel_matches" ADD CONSTRAINT "duel_matches_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duel_matches" ADD CONSTRAINT "duel_matches_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duel_matches" ADD CONSTRAINT "duel_matches_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
