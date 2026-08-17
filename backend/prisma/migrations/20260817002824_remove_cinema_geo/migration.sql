-- AlterEnum
BEGIN;

-- Delete any existing data that references CINEMA_GEO
DELETE FROM "TelemetryEvent" WHERE "category" = 'CINEMA_GEO';
DELETE FROM "SurvivalMatch" WHERE "category" = 'CINEMA_GEO';
DELETE FROM "DuelMatch" WHERE "category" = 'CINEMA_GEO';
DELETE FROM "GameResult" WHERE "category" = 'CINEMA_GEO';
DELETE FROM "MasteryAttempt" WHERE "category" = 'CINEMA_GEO';
DELETE FROM "Question" WHERE "category" = 'CINEMA_GEO';

-- Removing CINEMA_GEO from Challenge categories array if any challenge had it
UPDATE "Challenge" SET "categories" = array_remove("categories", 'CINEMA_GEO'::"Category");

-- Recreate type and update all tables
CREATE TYPE "Category_new" AS ENUM ('MAP', 'FLAG', 'CAPITAL', 'SILHOUETTE', 'MONUMENT', 'MIXED');

ALTER TABLE "Question" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");
ALTER TABLE "MasteryAttempt" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");
ALTER TABLE "GameResult" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");
ALTER TABLE "Challenge" ALTER COLUMN "categories" TYPE "Category_new"[] USING ("categories"::text[]::"Category_new"[]);
ALTER TABLE "DuelMatch" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");
ALTER TABLE "SurvivalMatch" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");
ALTER TABLE "TelemetryEvent" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");

ALTER TYPE "Category" RENAME TO "Category_old";
ALTER TYPE "Category_new" RENAME TO "Category";
DROP TYPE "Category_old";

COMMIT;
