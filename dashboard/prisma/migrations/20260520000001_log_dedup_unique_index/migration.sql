-- Add unique constraint on (serverId, type, prcTimestamp) for the Log table.
-- Enforces dedup at the DB level to match the bot's manual dedup logic.
--
-- PostgreSQL requires double-quotes around camelCase identifiers.
-- Unquoted names are folded to lowercase and won't match Prisma-generated columns.

-- Step 1: Remove duplicate rows, keeping the one with the lowest id per group.
DELETE FROM "Log"
WHERE "prcTimestamp" IS NOT NULL
  AND id NOT IN (
    SELECT MIN(id)
    FROM "Log"
    WHERE "prcTimestamp" IS NOT NULL
    GROUP BY "serverId", "type", "prcTimestamp"
  );

-- Step 2: Drop the old non-unique index if it exists.
DROP INDEX IF EXISTS "Log_serverId_type_prcTimestamp_idx";

-- Step 3: Create the unique index.
-- Rows where prcTimestamp IS NULL are treated as distinct by PostgreSQL
-- and are not subject to this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS "Log_serverId_type_prcTimestamp_key"
    ON "Log"("serverId", "type", "prcTimestamp");
