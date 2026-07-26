-- Widen the Log dedup unique key to match the app-level fingerprint in
-- log-syncer.ts: (serverId, type, prcTimestamp, playerId, killerId, victimId).
--
-- The previous key (serverId, type, prcTimestamp) was coarser than the app
-- dedup logic. When two different players produced a log in the same Unix
-- second, both rows passed the app-level filter but collided on the DB
-- constraint, aborting the whole createMany batch and silently discarding an
-- entire sync cycle. Widening the key removes that false collision.
--
-- The new key is strictly wider (more columns) than the old one, so any data
-- that satisfied the old constraint already satisfies the new one — no dedup
-- pass is required. NULL columns (playerId/killerId/victimId) are treated as
-- distinct by PostgreSQL, matching the app fingerprint's empty-string slots.

-- Step 1: Drop the old, narrower unique index.
DROP INDEX IF EXISTS "Log_serverId_type_prcTimestamp_key";

-- Step 2: Create the widened unique index.
CREATE UNIQUE INDEX IF NOT EXISTS "Log_serverId_type_prcTimestamp_playerId_killerId_victimId_key"
    ON "Log"("serverId", "type", "prcTimestamp", "playerId", "killerId", "victimId");
