-- AlterTable
ALTER TABLE "Member" ADD COLUMN "lastVerifiedAt" DATETIME;

-- CreateTable
CREATE TABLE "PlayerLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerName" TEXT,
    "locationX" REAL NOT NULL,
    "locationZ" REAL NOT NULL,
    "postalCode" TEXT,
    "streetName" TEXT,
    "buildingNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerLocation_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "callerName" TEXT,
    "description" TEXT,
    "callNumber" INTEGER,
    "positionX" REAL,
    "positionZ" REAL,
    "timestamp" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModCall_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmergencyCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "callerName" TEXT,
    "description" TEXT,
    "callNumber" INTEGER,
    "positionX" REAL,
    "positionZ" REAL,
    "positionDescriptor" TEXT,
    "timestamp" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmergencyCall_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VehicleLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerName" TEXT,
    "vehicleName" TEXT NOT NULL,
    "licensePlate" TEXT,
    "color" TEXT,
    "livery" TEXT,
    "positionX" REAL,
    "positionZ" REAL,
    "timestamp" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleLog_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "prcWebhookId" TEXT,
    "webhookEnabled" BOOLEAN NOT NULL DEFAULT true,
    "webhookPublicKey" TEXT DEFAULT 'MCowBQYDK2VwAyEAjSICb9pp0kHizGQtdG8ySWsDChfGqi+gyFCttigBNOA=',
    "loaChannelId" TEXT,
    "onLoaRoleId" TEXT,
    "featureLoa" BOOLEAN NOT NULL DEFAULT true,
    "featureStaffReq" BOOLEAN NOT NULL DEFAULT true,
    "featurePermLog" BOOLEAN NOT NULL DEFAULT true,
    "botMissingPermissions" BOOLEAN NOT NULL DEFAULT false,
    "deletionScheduledAt" DATETIME
);
INSERT INTO "new_Server" ("api_key", "autoSyncRoles", "bannerUrl", "botMissingPermissions", "commandLogChannelId", "createdAt", "customBotEnabled", "customBotToken", "customName", "deletionScheduledAt", "discordGuildId", "featureLoa", "featurePermLog", "featureStaffReq", "id", "loaChannelId", "maxUploadSize", "milestoneChannelId", "name", "onDutyRoleId", "onLoaRoleId", "permLogChannelId", "raidAlertChannelId", "staffRequestChannelId", "staffRequestRateLimit", "staffRoleId", "subscriberUserId", "subscriptionPlan", "suspendedRoleId", "terminatedRoleId", "webhookEvents", "webhookUrl") SELECT "api_key", "autoSyncRoles", "bannerUrl", "botMissingPermissions", "commandLogChannelId", "createdAt", "customBotEnabled", "customBotToken", "customName", "deletionScheduledAt", "discordGuildId", "featureLoa", "featurePermLog", "featureStaffReq", "id", "loaChannelId", "maxUploadSize", "milestoneChannelId", "name", "onDutyRoleId", "onLoaRoleId", "permLogChannelId", "raidAlertChannelId", "staffRequestChannelId", "staffRequestRateLimit", "staffRoleId", "subscriberUserId", "subscriptionPlan", "suspendedRoleId", "terminatedRoleId", "webhookEvents", "webhookUrl" FROM "Server";
DROP TABLE "Server";
ALTER TABLE "new_Server" RENAME TO "Server";

-- Populate prcWebhookId for existing servers using a random-like string based on their ID
UPDATE "Server" SET "prcWebhookId" = 'wh_' || SUBSTR("id", 1, 8) || SUBSTR(LOWER(HEX(RANDOMBLOB(4))), 1, 8) WHERE "prcWebhookId" IS NULL;

CREATE UNIQUE INDEX "Server_prcWebhookId_key" ON "Server"("prcWebhookId");
CREATE INDEX "Server_discordGuildId_idx" ON "Server"("discordGuildId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PlayerLocation_serverId_userId_createdAt_idx" ON "PlayerLocation"("serverId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "ModCall_serverId_createdAt_idx" ON "ModCall"("serverId", "createdAt");

-- CreateIndex
CREATE INDEX "EmergencyCall_serverId_createdAt_idx" ON "EmergencyCall"("serverId", "createdAt");

-- CreateIndex
CREATE INDEX "VehicleLog_serverId_createdAt_idx" ON "VehicleLog"("serverId", "createdAt");
