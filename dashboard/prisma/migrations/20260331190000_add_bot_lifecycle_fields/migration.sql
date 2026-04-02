-- AlterTable
ALTER TABLE "Server" ADD COLUMN "botMissingPermissions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Server" ADD COLUMN "deletionScheduledAt" DATETIME;
