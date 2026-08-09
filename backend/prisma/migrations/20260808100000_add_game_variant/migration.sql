-- CreateEnum
CREATE TYPE "GameVariant" AS ENUM ('CLASSIC', 'STREAK', 'FLASH', 'FLAG_MASTER', 'GEO_CHALLENGE');

-- AlterTable: add variant column to game_results
ALTER TABLE "game_results" ADD COLUMN "variant" "GameVariant" NOT NULL DEFAULT 'CLASSIC';

-- AlterTable: add variant column to duel_matches
ALTER TABLE "duel_matches" ADD COLUMN "variant" "GameVariant" NOT NULL DEFAULT 'CLASSIC';

-- CreateIndex for game_results
CREATE INDEX "game_results_userId_gameMode_variant_createdAt_idx" ON "game_results"("userId", "gameMode", "variant", "createdAt");

-- CreateIndex for game_results
CREATE INDEX "game_results_gameMode_variant_createdAt_idx" ON "game_results"("gameMode", "variant", "createdAt");

-- Backfill: set variant = FLAG_MASTER for existing records where details contain flagMaster: true
UPDATE "game_results" SET "variant" = 'FLAG_MASTER'::"GameVariant"
WHERE "details"::jsonb @> '{"flagMaster": true}';
