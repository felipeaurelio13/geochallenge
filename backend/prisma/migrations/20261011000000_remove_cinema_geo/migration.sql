-- Cinema & Geography was removed from the product, but its original removal
-- migration was not retained in the migration history. Clean all live and
-- persisted references before rebuilding the enum without CINEMA_GEO.
BEGIN;

-- Existing challenges that selected a cinema question cannot remain playable
-- after the question rows are removed. Preserve their audit trail, but expire
-- them instead of serving a partial challenge.
UPDATE "challenges"
SET "status" = 'EXPIRED'
WHERE EXISTS (
  SELECT 1
  FROM "questions"
  WHERE "questions"."category" = 'CINEMA_GEO'
    AND "questions"."id" = ANY("challenges"."questionIds")
);

UPDATE "challenges"
SET "categories" = array_remove("categories", 'CINEMA_GEO'::"Category")
WHERE "categories" @> ARRAY['CINEMA_GEO'::"Category"];

-- Daily and World Event plans persist question IDs. Drop only plans that
-- include cinema questions so the services regenerate valid replacements.
DELETE FROM "daily_challenge_plans" AS plan
USING "questions" AS question
WHERE question."category" = 'CINEMA_GEO'
  AND plan."questionIds" @> jsonb_build_array(question."id");

DELETE FROM "world_event_boss_answers" AS answer
USING "world_event_boss_attempts" AS attempt,
      "world_event_plans" AS plan,
      "questions" AS question
WHERE answer."attemptId" = attempt."id"
  AND attempt."eventId" = plan."eventId"
  AND question."category" = 'CINEMA_GEO'
  AND plan."questionIds" @> jsonb_build_array(question."id");

DELETE FROM "world_event_boss_attempts" AS attempt
USING "world_event_plans" AS plan,
      "questions" AS question
WHERE attempt."eventId" = plan."eventId"
  AND question."category" = 'CINEMA_GEO'
  AND plan."questionIds" @> jsonb_build_array(question."id");

DELETE FROM "world_event_plans" AS plan
USING "questions" AS question
WHERE question."category" = 'CINEMA_GEO'
  AND plan."questionIds" @> jsonb_build_array(question."id");

DELETE FROM "telemetry_events" WHERE "category" = 'CINEMA_GEO';
DELETE FROM "survival_matches" WHERE "category" = 'CINEMA_GEO';
DELETE FROM "duel_matches" WHERE "category" = 'CINEMA_GEO';
DELETE FROM "game_results" WHERE "category" = 'CINEMA_GEO';
DELETE FROM "mastery_attempts" WHERE "category" = 'CINEMA_GEO';
DELETE FROM "questions" WHERE "category" = 'CINEMA_GEO';

CREATE TYPE "Category_new" AS ENUM ('MAP', 'FLAG', 'CAPITAL', 'SILHOUETTE', 'MONUMENT', 'MIXED');

ALTER TABLE "questions" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");
ALTER TABLE "mastery_attempts" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");
ALTER TABLE "game_results" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");
ALTER TABLE "challenges" ALTER COLUMN "categories" TYPE "Category_new"[] USING ("categories"::text[]::"Category_new"[]);
ALTER TABLE "duel_matches" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");
ALTER TABLE "survival_matches" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");
ALTER TABLE "telemetry_events" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");

ALTER TYPE "Category" RENAME TO "Category_old";
ALTER TYPE "Category_new" RENAME TO "Category";
DROP TYPE "Category_old";

COMMIT;
