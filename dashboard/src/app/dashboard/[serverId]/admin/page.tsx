import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isSuperAdmin, isServerOwner } from "@/lib/admin"
import { isServerFeatureEnabled } from "@/lib/feature-flags"
import { redirect } from "next/navigation"
import { Settings, Upload, Users } from "lucide-react"
import { ServerSettingsForm } from "./server-settings-form"
import { AdminAccessManager } from "./admin-access-manager"
import { DataExportsPanel } from "@/components/admin/data-exports-panel"

export default async function AdminGeneralPage({ params }: { params: Promise<{ serverId: string }> }) {
    const session = await getSession()
    if (!session) redirect("/login")

    const { serverId } = await params

    const server = (await prisma.server.findUnique({
        where: { id: serverId }
    })) as any

    if (!server) {
        return <div className="text-center text-zinc-500">Server not found</div>
    }

    const superAdmin = isSuperAdmin(session.user)
    const isOwner = await isServerOwner(session.user as any, serverId)

    // Get all members for owner transfer
    const members = isOwner ? await prisma.member.findMany({
        where: { serverId }
    }) : []

    // Get all admins for this server
    const admins = await prisma.member.findMany({
        where: { serverId, isAdmin: true }
    })

    // Get all roles for this server
    const roles = await prisma.role.findMany({
        where: { serverId },
        orderBy: { quotaMinutes: 'desc' }
    })

    // Check export feature
    const hasExportAccess = await isServerFeatureEnabled('EXPORTS', serverId)

    return (
        <div className="space-y-8">
            {/* Server Settings */}
            <div className="bg-[#1a1a1a] rounded-xl border border-[#222] overflow-hidden">
                <div className="p-6 border-b border-[#222]">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                            <Settings className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="font-bold text-white">Server Settings</h2>
                            <p className="text-xs text-zinc-500">Configure server display settings</p>
                        </div>
                    </div>
                </div>
                <div className="p-6">
                    <ServerSettingsForm
                        serverId={serverId}
                        currentName={server.customName || server.name}
                        currentBanner={server.bannerUrl}
                        currentOnDutyRoleId={server.onDutyRoleId}
                        currentDiscordGuildId={server.discordGuildId}
                        currentAutoSyncRoles={server.autoSyncRoles}
                        currentSuspendedRoleId={server.suspendedRoleId}
                        currentTerminatedRoleId={server.terminatedRoleId}
                        currentStaffRoleId={server.staffRoleId}
                        currentPermLogChannelId={server.permLogChannelId}
                        currentStaffRequestChannelId={server.staffRequestChannelId}
                        currentRaidAlertChannelId={server.raidAlertChannelId}
                        currentCommandLogChannelId={server.commandLogChannelId}
                        currentMilestoneChannelId={server.milestoneChannelId}
                        currentLoaChannelId={server.loaChannelId}
                        currentOnLoaRoleId={server.onLoaRoleId}
                        currentCustomBotToken={server.customBotToken}
                        currentCustomBotEnabled={server.customBotEnabled}
                        subscriptionPlan={server.subscriptionPlan}
                        currentMaxUploadSize={server.maxUploadSize}
                        currentStaffRequestRateLimit={server.staffRequestRateLimit}
                        featureLoa={server.featureLoa}
                        featureStaffReq={server.featureStaffReq}
                        featurePermLog={server.featurePermLog}
                        currentWebhookUrl={server.webhookUrl}
                        currentWebhookEvents={server.webhookEvents}
                        isOwner={isOwner}
                        serverMembers={members}
                        botMissingPermissions={server.botMissingPermissions}
                        deletionScheduledAt={server.deletionScheduledAt}
                    />
                </div>
            </div>

            {/* Data Exports */}
            <DataExportsPanel serverId={serverId} hasExportAccess={hasExportAccess} />

            {/* Admin Access - Only visible to superadmin */}
            {superAdmin && (
                <div className="bg-[#1a1a1a] rounded-xl border border-[#222] overflow-hidden">
                    <div className="p-6 border-b border-[#222]">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <Users className="h-5 w-5 text-amber-400" />
                            </div>
                            <div>
                                <h2 className="font-bold text-white">Admin Access</h2>
                                <p className="text-xs text-zinc-500">Manage who can access this admin panel</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <AdminAccessManager serverId={serverId} admins={admins} roles={roles} />
                    </div>
                </div>
            )}
        </div>
    )
}
