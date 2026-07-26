-- Rotector third-party safety-signal cache and access log.
--
-- RotectorFlag stores only the bare flagType integer returned by Rotector's
-- status-only batch endpoint — never category/reasons/confidence/evidence
-- (see rotector-integration-compliance.md, Ingestion CANNOTs). flagType 8
-- (redacted) is never written here; the app deletes the row on sight instead.
--
-- RotectorFlagView is an access log: one row per disclosure of a flag to a
-- moderator (actor, subject, timestamp), retained separately from the flag
-- cache itself per the compliance doc's access-logging requirement.

-- CreateTable
CREATE TABLE "RotectorFlag" (
    "robloxId" TEXT NOT NULL,
    "flagType" INTEGER NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RotectorFlag_pkey" PRIMARY KEY ("robloxId")
);

-- CreateTable
CREATE TABLE "RotectorFlagView" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "robloxId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RotectorFlagView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RotectorFlagView_serverId_idx" ON "RotectorFlagView"("serverId");

-- CreateIndex
CREATE INDEX "RotectorFlagView_robloxId_idx" ON "RotectorFlagView"("robloxId");
