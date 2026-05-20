-- Add unique constraint on (serverId, type, prcTimestamp) for the Log table.
-- Enforces dedup at the DB level to match the bot's manual dedup logic.
--
-- PostgreSQL requires double-quotes around camelCase identifiers.
--
-- Step 1: Remove duplicate rows using a window function.
-- ROW_NUMBER() OVER (PARTITION BY ...) is a single sequential pass — far cheaper
-- than NOT IN (SELECT MIN ... GROUP BY) which does a correlated scan per row.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "serverId", "type", "prcTimestamp"
           ORDER BY id
         ) AS rn
  FROM "Log"
  WHERE "prcTimestamp" IS NOT NULL
)
DELETE FROM "Log"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: Drop the old non-unique index if it exists.
DROP INDEX IF EXISTS "Log_serverId_type_prcTimestamp_idx";

-- Step 3: Create the unique index.
-- Rows where prcTimestamp IS NULL are treated as distinct by PostgreSQL
-- and are not subject to this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS "Log_serverId_type_prcTimestamp_key"
    ON "Log"("serverId", "type", "prcTimestamp");
