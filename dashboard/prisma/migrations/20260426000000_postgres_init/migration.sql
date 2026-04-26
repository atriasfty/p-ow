-- CreateTable
CREATE TABLE "VisionHandshake" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisionHandshake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Server" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "settings" TEXT,
    "botMissingPermissions" BOOLEAN NOT NULL DEFAULT false,
    "deletionScheduledAt" TIMESTAMP(3),

    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMilestone" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requiredMinutes" INTEGER NOT NULL,
    "rewardRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "playerName" TEXT,
    "playerId" TEXT,
    "killerName" TEXT,
    "killerId" TEXT,
    "victimName" TEXT,
    "victimId" TEXT,
    "command" TEXT,
    "arguments" TEXT,
    "isJoin" BOOLEAN NOT NULL DEFAULT true,
    "prcTimestamp" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Punishment" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Punishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discordId" TEXT,
    "robloxId" TEXT,
    "robloxUsername" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "serverId" TEXT NOT NULL,
    "roleId" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveOfAbsence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "robloxUsername" TEXT,
    "serverId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveOfAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "serverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotQueue" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MESSAGE',
    "targetId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "BotQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserAiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsed" TIMESTAMP(3),
    "serverId" TEXT,
    "rateLimit" INTEGER NOT NULL DEFAULT 5,
    "dailyLimit" INTEGER NOT NULL DEFAULT 500,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allowedIps" TEXT,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BannedIp" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BannedIp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityLog" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "ip" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'API',
    "serverId" TEXT,
    "creatorId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "bannerUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "requiresAuth" BOOLEAN NOT NULL DEFAULT false,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "allowMultiple" BOOLEAN NOT NULL DEFAULT true,
    "maxResponses" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "isApplication" BOOLEAN NOT NULL DEFAULT false,
    "acceptedRoleId" TEXT,
    "recruitmentChannelId" TEXT,
    "congratsChannelId" TEXT,
    "notifyChannelId" TEXT,
    "thankYouMessage" TEXT,
    "requiredRoleIds" TEXT,
    "ignoredRoleIds" TEXT,
    "publicShareId" TEXT NOT NULL,
    "editorShareId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSection" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FormSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormQuestion" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" TEXT NOT NULL DEFAULT '{}',
    "conditions" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "FormQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormResponse" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "respondentId" TEXT,
    "respondentEmail" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'completed',

    CONSTRAINT "FormResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormAnswer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "FormAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormEditorAccess" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormEditorAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerLocation" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerName" TEXT,
    "locationX" DOUBLE PRECISION NOT NULL,
    "locationZ" DOUBLE PRECISION NOT NULL,
    "postalCode" TEXT,
    "streetName" TEXT,
    "buildingNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModCall" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "callerName" TEXT,
    "description" TEXT,
    "callNumber" INTEGER,
    "positionX" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION,
    "positionDescriptor" TEXT,
    "respondingPlayers" TEXT,
    "timestamp" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyCall" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "callerName" TEXT,
    "description" TEXT,
    "callNumber" INTEGER,
    "positionX" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION,
    "positionDescriptor" TEXT,
    "timestamp" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleLog" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerName" TEXT,
    "vehicleName" TEXT NOT NULL,
    "licensePlate" TEXT,
    "color" TEXT,
    "livery" TEXT,
    "positionX" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION,
    "timestamp" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisionHandshake_code_key" ON "VisionHandshake"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Server_prcWebhookId_key" ON "Server"("prcWebhookId");

-- CreateIndex
CREATE INDEX "Server_discordGuildId_idx" ON "Server"("discordGuildId");

-- CreateIndex
CREATE INDEX "StaffMilestone_serverId_idx" ON "StaffMilestone"("serverId");

-- CreateIndex
CREATE INDEX "Log_serverId_createdAt_idx" ON "Log"("serverId", "createdAt");

-- CreateIndex
CREATE INDEX "Log_serverId_type_prcTimestamp_idx" ON "Log"("serverId", "type", "prcTimestamp");

-- CreateIndex
CREATE INDEX "Log_playerId_idx" ON "Log"("playerId");

-- CreateIndex
CREATE INDEX "Log_killerId_idx" ON "Log"("killerId");

-- CreateIndex
CREATE INDEX "Log_victimId_idx" ON "Log"("victimId");

-- CreateIndex
CREATE INDEX "Punishment_serverId_userId_createdAt_idx" ON "Punishment"("serverId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "Shift_userId_startTime_idx" ON "Shift"("userId", "startTime");

-- CreateIndex
CREATE INDEX "Shift_serverId_startTime_idx" ON "Shift"("serverId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "Member_userId_serverId_key" ON "Member"("userId", "serverId");

-- CreateIndex
CREATE INDEX "Member_userId_idx" ON "Member"("userId");

-- CreateIndex
CREATE INDEX "Member_discordId_serverId_idx" ON "Member"("discordId", "serverId");

-- CreateIndex
CREATE INDEX "Member_robloxId_idx" ON "Member"("robloxId");

-- CreateIndex
CREATE INDEX "LeaveOfAbsence_serverId_status_idx" ON "LeaveOfAbsence"("serverId", "status");

-- CreateIndex
CREATE INDEX "LeaveOfAbsence_userId_idx" ON "LeaveOfAbsence"("userId");

-- CreateIndex
CREATE INDEX "Automation_serverId_idx" ON "Automation"("serverId");

-- CreateIndex
CREATE INDEX "BotQueue_serverId_status_idx" ON "BotQueue"("serverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserAiUsage_userId_day_month_year_key" ON "UserAiUsage"("userId", "day", "month", "year");

-- CreateIndex
CREATE INDEX "UserAiUsage_userId_idx" ON "UserAiUsage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_serverId_idx" ON "ApiKey"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "BannedIp_ip_key" ON "BannedIp"("ip");

-- CreateIndex
CREATE INDEX "SecurityLog_serverId_idx" ON "SecurityLog"("serverId");

-- CreateIndex
CREATE INDEX "SecurityLog_ip_idx" ON "SecurityLog"("ip");

-- CreateIndex
CREATE INDEX "SecurityLog_createdAt_idx" ON "SecurityLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Form_publicShareId_key" ON "Form"("publicShareId");

-- CreateIndex
CREATE UNIQUE INDEX "Form_editorShareId_key" ON "Form"("editorShareId");

-- CreateIndex
CREATE INDEX "Form_serverId_idx" ON "Form"("serverId");

-- CreateIndex
CREATE INDEX "Form_publicShareId_idx" ON "Form"("publicShareId");

-- CreateIndex
CREATE INDEX "Form_editorShareId_idx" ON "Form"("editorShareId");

-- CreateIndex
CREATE INDEX "FormSection_formId_idx" ON "FormSection"("formId");

-- CreateIndex
CREATE INDEX "FormQuestion_sectionId_idx" ON "FormQuestion"("sectionId");

-- CreateIndex
CREATE INDEX "FormResponse_formId_idx" ON "FormResponse"("formId");

-- CreateIndex
CREATE INDEX "FormResponse_respondentId_idx" ON "FormResponse"("respondentId");

-- CreateIndex
CREATE UNIQUE INDEX "FormAnswer_responseId_questionId_key" ON "FormAnswer"("responseId", "questionId");

-- CreateIndex
CREATE INDEX "FormAnswer_responseId_idx" ON "FormAnswer"("responseId");

-- CreateIndex
CREATE INDEX "FormAnswer_questionId_idx" ON "FormAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "FormEditorAccess_formId_userId_key" ON "FormEditorAccess"("formId", "userId");

-- CreateIndex
CREATE INDEX "FormEditorAccess_userId_idx" ON "FormEditorAccess"("userId");

-- CreateIndex
CREATE INDEX "PlayerLocation_serverId_userId_createdAt_idx" ON "PlayerLocation"("serverId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "ModCall_serverId_createdAt_idx" ON "ModCall"("serverId", "createdAt");

-- CreateIndex
CREATE INDEX "EmergencyCall_serverId_createdAt_idx" ON "EmergencyCall"("serverId", "createdAt");

-- CreateIndex
CREATE INDEX "VehicleLog_serverId_createdAt_idx" ON "VehicleLog"("serverId", "createdAt");

-- AddForeignKey
ALTER TABLE "StaffMilestone" ADD CONSTRAINT "StaffMilestone_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Punishment" ADD CONSTRAINT "Punishment_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveOfAbsence" ADD CONSTRAINT "LeaveOfAbsence_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotQueue" ADD CONSTRAINT "BotQueue_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSection" ADD CONSTRAINT "FormSection_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormQuestion" ADD CONSTRAINT "FormQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "FormSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAnswer" ADD CONSTRAINT "FormAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "FormResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAnswer" ADD CONSTRAINT "FormAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FormQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormEditorAccess" ADD CONSTRAINT "FormEditorAccess_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerLocation" ADD CONSTRAINT "PlayerLocation_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModCall" ADD CONSTRAINT "ModCall_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyCall" ADD CONSTRAINT "EmergencyCall_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleLog" ADD CONSTRAINT "VehicleLog_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
