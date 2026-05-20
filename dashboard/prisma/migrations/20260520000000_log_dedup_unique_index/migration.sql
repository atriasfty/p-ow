-- Migration: add unique constraint on (serverId, type, prcTimestamp) for Log table
-- This enforces deduplication at the DB level and matches the bot schema.
--
-- Step 1: Remove any existing duplicate rows (keep the row with the lowest id
--         among each (serverId, type, prcTimestamp) group where prcTimestamp IS NOT NULL).
DELETE FROM "Log"
WHERE prcTimestamp IS NOT NULL
  AND id NOT IN (
    SELECT MIN(id)
    FROM "Log"
    WHERE prcTimestamp IS NOT NULL
    GROUP BY serverId, type, prcTimestamp
  );

-- Step 2: Drop the existing non-unique index (Prisma will replace it with the unique one).
DROP INDEX IF EXISTS "Log_serverId_type_prcTimestamp_idx";

-- Step 3: Create the unique index (NULL values are treated as distinct in SQLite,
--         so rows with prcTimestamp = NULL are still allowed to coexist).
CREATE UNIQUE INDEX IF NOT EXISTS "Log_serverId_type_prcTimestamp_key"
    ON "Log"("serverId", "type", "prcTimestamp");
