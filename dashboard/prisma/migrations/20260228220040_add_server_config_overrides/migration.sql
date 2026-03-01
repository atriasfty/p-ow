/*
  Warnings:

  - A unique constraint covering the columns `[serverId,type,prcTimestamp]` on the table `Log` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Server" ADD COLUMN "automationCacheTtl" INTEGER;
ALTER TABLE "Server" ADD COLUMN "logCacheTtl" INTEGER;
ALTER TABLE "Server" ADD COLUMN "maxUploadSize" INTEGER;
ALTER TABLE "Server" ADD COLUMN "staffRequestRateLimit" INTEGER;

-- CreateIndex
CREATE INDEX "Log_serverId_type_prcTimestamp_key" ON "Log"("serverId", "type", "prcTimestamp");
