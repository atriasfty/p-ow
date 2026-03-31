/*
  Warnings:

  - You are about to drop the column `applicationAiThreshold` on the `Server` table. All the data in the column will be lost.
  - You are about to drop the column `autoStaffRoleId` on the `Server` table. All the data in the column will be lost.
  - You are about to drop the column `automationCacheTtl` on the `Server` table. All the data in the column will be lost.
  - You are about to drop the column `congratsChannelId` on the `Server` table. All the data in the column will be lost.
  - You are about to drop the column `logCacheTtl` on the `Server` table. All the data in the column will be lost.
  - You are about to drop the column `recruitmentChannelId` on the `Server` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN "allowedIps" TEXT;

-- AlterTable
ALTER TABLE "Form" ADD COLUMN "congratsChannelId" TEXT;
ALTER TABLE "Form" ADD COLUMN "recruitmentChannelId" TEXT;

-- CreateTable
CREATE TABLE "VisionHandshake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BotQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MESSAGE',
    "targetId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "processedAt" DATETIME,
    CONSTRAINT "BotQueue_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BotQueue" ("content", "createdAt", "error", "id", "processedAt", "serverId", "status", "targetId", "type", "updatedAt") SELECT "content", "createdAt", "error", "id", "processedAt", "serverId", "status", "targetId", "type", "updatedAt" FROM "BotQueue";
DROP TABLE "BotQueue";
ALTER TABLE "new_BotQueue" RENAME TO "BotQueue";
CREATE INDEX "BotQueue_serverId_status_idx" ON "BotQueue"("serverId", "status");
CREATE TABLE "new_Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#ffffff',
    "quotaMinutes" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "discordRoleId" TEXT,
    "canShift" BOOLEAN NOT NULL DEFAULT true,
    "canViewOtherShifts" BOOLEAN NOT NULL DEFAULT true,
    "canViewLogs" BOOLEAN NOT NULL DEFAULT true,
    "canViewPunishments" BOOLEAN NOT NULL DEFAULT true,
    "canIssueWarnings" BOOLEAN NOT NULL DEFAULT true,
    "canKick" BOOLEAN NOT NULL DEFAULT true,
    "canBan" BOOLEAN NOT NULL DEFAULT true,
    "canBanBolo" BOOLEAN NOT NULL DEFAULT true,
    "canUseToolbox" BOOLEAN NOT NULL DEFAULT true,
    "canManageBolos" BOOLEAN NOT NULL DEFAULT true,
    "canRequestLoa" BOOLEAN NOT NULL DEFAULT true,
    "canViewQuota" BOOLEAN NOT NULL DEFAULT true,
    "canUseAdminCommands" BOOLEAN NOT NULL DEFAULT false,
    "canAccessAdmin" BOOLEAN NOT NULL DEFAULT false,
    "serverId" TEXT NOT NULL,
    CONSTRAINT "Role_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Role" ("canBan", "canBanBolo", "canIssueWarnings", "canKick", "canManageBolos", "canRequestLoa", "canShift", "canUseAdminCommands", "canUseToolbox", "canViewLogs", "canViewOtherShifts", "canViewPunishments", "canViewQuota", "color", "discordRoleId", "id", "isDefault", "name", "quotaMinutes", "serverId") SELECT "canBan", "canBanBolo", "canIssueWarnings", "canKick", "canManageBolos", "canRequestLoa", "canShift", "canUseAdminCommands", "canUseToolbox", "canViewLogs", "canViewOtherShifts", "canViewPunishments", "canViewQuota", "color", "discordRoleId", "id", "isDefault", "name", "quotaMinutes", "serverId" FROM "Role";
DROP TABLE "Role";
ALTER TABLE "new_Role" RENAME TO "Role";
CREATE TABLE "new_Server" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "bannerUrl" TEXT,
    "customName" TEXT,
    "discordGuildId" TEXT,
    "suspendedRoleId" TEXT,
    "terminatedRoleId" TEXT,
    "staffRoleId" TEXT,
    "permLogChannelId" TEXT,
    "staffRequestChannelId" TEXT,
    "raidAlertChannelId" TEXT,
    "commandLogChannelId" TEXT,
    "milestoneChannelId" TEXT,
    "onDutyRoleId" TEXT,
    "autoSyncRoles" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscriberUserId" TEXT,
    "subscriptionPlan" TEXT,
    "customBotToken" TEXT,
    "customBotEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxUploadSize" INTEGER,
    "staffRequestRateLimit" INTEGER,
    "webhookUrl" TEXT,
    "webhookEvents" TEXT,
    "loaChannelId" TEXT,
    "onLoaRoleId" TEXT,
    "featureLoa" BOOLEAN NOT NULL DEFAULT true,
    "featureStaffReq" BOOLEAN NOT NULL DEFAULT true,
    "featurePermLog" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Server" ("api_key", "autoSyncRoles", "bannerUrl", "commandLogChannelId", "createdAt", "customBotEnabled", "customBotToken", "customName", "discordGuildId", "id", "loaChannelId", "maxUploadSize", "milestoneChannelId", "name", "onDutyRoleId", "onLoaRoleId", "permLogChannelId", "raidAlertChannelId", "staffRequestChannelId", "staffRequestRateLimit", "staffRoleId", "subscriberUserId", "subscriptionPlan", "suspendedRoleId", "terminatedRoleId") SELECT "api_key", "autoSyncRoles", "bannerUrl", "commandLogChannelId", "createdAt", "customBotEnabled", "customBotToken", "customName", "discordGuildId", "id", "loaChannelId", "maxUploadSize", "milestoneChannelId", "name", "onDutyRoleId", "onLoaRoleId", "permLogChannelId", "raidAlertChannelId", "staffRequestChannelId", "staffRequestRateLimit", "staffRoleId", "subscriberUserId", "subscriptionPlan", "suspendedRoleId", "terminatedRoleId" FROM "Server";
DROP TABLE "Server";
ALTER TABLE "new_Server" RENAME TO "Server";
CREATE INDEX "Server_discordGuildId_idx" ON "Server"("discordGuildId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "VisionHandshake_code_key" ON "VisionHandshake"("code");
