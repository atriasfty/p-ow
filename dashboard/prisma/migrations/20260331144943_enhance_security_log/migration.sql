/*
  Warnings:

  - You are about to drop the column `userId` on the `SecurityLog` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SecurityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "ip" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'API',
    "serverId" TEXT,
    "creatorId" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SecurityLog" ("createdAt", "details", "event", "id", "ip") SELECT "createdAt", "details", "event", "id", "ip" FROM "SecurityLog";
DROP TABLE "SecurityLog";
ALTER TABLE "new_SecurityLog" RENAME TO "SecurityLog";
CREATE INDEX "SecurityLog_serverId_idx" ON "SecurityLog"("serverId");
CREATE INDEX "SecurityLog_ip_idx" ON "SecurityLog"("ip");
CREATE INDEX "SecurityLog_createdAt_idx" ON "SecurityLog"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
