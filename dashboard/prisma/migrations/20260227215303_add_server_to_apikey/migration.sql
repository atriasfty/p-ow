/*
  Warnings:

  - Added the required column `serverId` to the `ApiKey` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsed" DATETIME,
    "serverId" TEXT,
    "rateLimit" INTEGER NOT NULL DEFAULT 5,
    "dailyLimit" INTEGER NOT NULL DEFAULT 500,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "resetAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ApiKey" ("createdAt", "dailyLimit", "enabled", "id", "key", "lastUsed", "name", "rateLimit", "resetAt", "usageCount") SELECT "createdAt", "dailyLimit", "enabled", "id", "key", "lastUsed", "name", "rateLimit", "resetAt", "usageCount" FROM "ApiKey";
DROP TABLE "ApiKey";
ALTER TABLE "new_ApiKey" RENAME TO "ApiKey";
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");
CREATE INDEX "ApiKey_serverId_idx" ON "ApiKey"("serverId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
