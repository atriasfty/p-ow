-- Store API keys as SHA-256 hashes instead of plaintext, so a DB/backup leak no
-- longer yields directly usable, replayable keys.
--
-- Additive + backward compatible: the legacy plaintext "key" column is kept and
-- made nullable (not dropped) so that during a blue-green deploy the still-running
-- old release can continue to look keys up by plaintext until it is retired. New
-- keys are created with keyHash/keyPrefix only (no plaintext). A follow-up
-- migration can DROP the "key" column once no release reads it.

ALTER TABLE "ApiKey" ADD COLUMN "keyHash" TEXT;
ALTER TABLE "ApiKey" ADD COLUMN "keyPrefix" TEXT;

-- The column was NOT NULL; new keys won't populate it, so relax the constraint.
ALTER TABLE "ApiKey" ALTER COLUMN "key" DROP NOT NULL;

-- Backfill hash + display prefix for all existing keys (Postgres has a built-in
-- sha256() over bytea since v11). After this every existing row is resolvable by
-- keyHash, matching how the application now looks keys up.
UPDATE "ApiKey"
SET "keyHash" = encode(sha256("key"::bytea), 'hex'),
    "keyPrefix" = substring("key" from 1 for 12)
WHERE "key" IS NOT NULL AND "keyHash" IS NULL;

CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
