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
DECLARE
  finalization_table TEXT;
  has_pending_finalizations BOOLEAN;
BEGIN
  -- The original migration created CamelCase. A short-lived Prisma mapping
  -- also used snake_case, so accept either physical table during convergence.
  FOREACH finalization_table IN ARRAY ARRAY[
    'PendingGameFinalization',
    'pending_game_finalizations'
  ]
  LOOP
    IF to_regclass(format('%I', finalization_table)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I WHERE "status" <> ''COMPLETED'')',
      finalization_table
    ) INTO has_pending_finalizations;

    IF has_pending_finalizations THEN
      RAISE EXCEPTION
        'Pending game finalizations remain in %. Resolve them before applying 20261012000000_simplify_game_finalization.',
        finalization_table;
    END IF;

    EXECUTE format('DROP TABLE %I', finalization_table);
  END LOOP;
END $$;
