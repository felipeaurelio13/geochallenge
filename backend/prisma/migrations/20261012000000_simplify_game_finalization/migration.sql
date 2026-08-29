-- Survival finalization is idempotent per participant. Remove any historical
-- duplicate rows before enforcing the database invariant.
DELETE FROM "survival_participants" duplicate
USING "survival_participants" canonical
WHERE duplicate."matchId" = canonical."matchId"
  AND duplicate."userId" = canonical."userId"
  AND duplicate."id" > canonical."id";

CREATE UNIQUE INDEX "survival_participants_matchId_userId_key"
ON "survival_participants"("matchId", "userId");

-- Do not discard an unfinished durable payload. Operators must replay or
-- resolve it before this migration can remove the obsolete recovery table.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "pending_game_finalizations"
    WHERE "status" <> 'COMPLETED'
  ) THEN
    RAISE EXCEPTION
      'Pending game finalizations remain. Resolve them before applying 20261012000000_simplify_game_finalization.';
  END IF;
END $$;

DROP TABLE "pending_game_finalizations";
