-- CreateTable
CREATE TABLE "VisionDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceSecret" TEXT NOT NULL,
    "deviceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "VisionDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisionDevice_userId_idx" ON "VisionDevice"("userId");
