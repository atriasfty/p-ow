-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BotQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    CONSTRAINT "BotQueue_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BotQueue" ("content", "createdAt", "error", "id", "processedAt", "serverId", "status", "targetId", "type") SELECT "content", "createdAt", "error", "id", "processedAt", "serverId", "status", "targetId", coalesce("type", 'MESSAGE') FROM "BotQueue";
DROP TABLE "BotQueue";
ALTER TABLE "new_BotQueue" RENAME TO "BotQueue";
CREATE INDEX "BotQueue_serverId_status_idx" ON "BotQueue"("serverId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
