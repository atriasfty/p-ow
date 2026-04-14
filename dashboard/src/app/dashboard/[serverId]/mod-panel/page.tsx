import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { Shield, Zap, MessageSquare, Briefcase, History, Filter, Search, MoreVertical, Play, Settings, Calendar, FileText } from "lucide-react"
import { EnsureDiscordConnection } from "@/components/auth/ensure-discord"
import { RoleSyncWrapper } from "@/components/auth/role-sync-wrapper"
import { ShiftButton } from "@/components/shifts/shift-button"
import { LogViewer } from "@/components/logs/log-viewer"
import { fetchServerStats } from "@/lib/server-utils"
import { ShiftTimer } from "./shift-timer"
import { PlayerManager } from "@/components/mod-panel/player-manager"
import { PunishmentList } from "@/components/mod-panel/punishment-list"
import { Toolbox } from "@/components/mod-panel/toolbox"
import { MobileToolbox } from "@/components/mod-panel/MobileToolbox"
import { ServerStatsHeader } from "@/components/mod-panel/server-stats-header"
import { StaffOnDutyAvatars } from "@/components/mod-panel/staff-on-duty-avatars"
import { isServerAdmin, getActiveLeave, getUserPermissions } from "@/lib/admin"
import { MobileModPanel } from "@/components/mod-panel/MobileModPanel"
import { SsdNotification } from "@/components/mod-panel/ssd-notification"
import Link from "next/link"
import { WarningBanner } from "@/components/ui/warning-banner"
import { ServerEventsProvider } from "@/components/providers/server-events-provider"
import { ModCallDetector } from "@/components/mod-panel/mod-call-detector"

// Force dynamic rendering to ensure shift state is always fresh
export const dynamic = 'force-dynamic'

import { checkConnectionRequirements } from "@/lib/auth-server"
import { ConnectionRequirementScreen } from "@/components/auth/connection-requirement-screen"

export default async function ModPanelPage({
    params,
}: {
    params: Promise<{ serverId: string }>
}) {
    const session = await getSession()
    if (!session) redirect("/login")

    // Enforce Connection Requirements Server-Side to prevent RSC Payload Leaks
    const check = checkConnectionRequirements(session.user)
    if (!check.valid) {
        return (
            <ConnectionRequirementScreen
                missing={check.missing}
                discordUsername={session.user.username} // Best effort, usually Clerk username matches Discord if linked correctly or we can use the one from check result if we improved it
                robloxUsername={check.robloxUsername}
            />
        )
    }

    const { serverId } = await params

    const server = await prisma.server.findUnique({ where: { id: serverId } })
    if (!server) return <div>Server not found</div>

    // Get User Permissions
    const permissions = await getUserPermissions(session.user, serverId)

    // We defer the "other staff" fetching to a client component for better real-time updates
    const serverStats = await fetchServerStats(server.apiUrl)

    // Fetch recent punishments for right column - Filtered by serverId to prevent leaks
    const recentPunishments = permissions.canViewPunishments ? await prisma.punishment.findMany({
        where: { serverId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
            id: true,
            userId: true,
            moderatorId: true,
            type: true,
            reason: true,
            resolved: true,
            createdAt: true
        }
    }) : []

    // Build list of all possible user IDs for this user
    const possibleIds = [
        session.user.id,
        session.user.discordId,
        session.user.robloxId
    ].filter(Boolean) as string[]

    // Broaden member lookup: Check if 'userId' column matches ANY of our possible IDs
    const member = await prisma.member.findFirst({
        where: {
            serverId,
            OR: [
                { userId: { in: possibleIds } },
                { discordId: session.user.discordId }
            ]
        },
        include: { role: true }
    })

    // Find the current user's shift by checking all possible user IDs
    // AND the member's specific userId if it was found and different
    const shiftUserIds = member ? Array.from(new Set([...possibleIds, member.userId])) : possibleIds

    const myShift = await prisma.shift.findFirst({
        where: {
            userId: { in: shiftUserIds },
            endTime: null,
            serverId
        }
    })

    const quotaMinutes = member?.role?.quotaMinutes || 0

    // 2. Get week start (Monday) for quota calculation
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const weekStart = new Date(now)
    weekStart.setDate(diff)
    weekStart.setHours(0, 0, 0, 0)

    // Fix: Quota duration should be per-server for accuracy
    const weeklyShifts = await prisma.shift.findMany({
        where: {
            serverId,
            userId: { in: shiftUserIds },
            startTime: { gte: weekStart },
            endTime: { not: null }
        }
    })

    const weeklyDurationSeconds = weeklyShifts.reduce((acc: number, s: any) => acc + (s.duration || 0), 0)
    const weeklyDurationMinutes = Math.floor(weeklyDurationSeconds / 60)
    const quotaProgress = quotaMinutes > 0 ? Math.min(100, Math.round((weeklyDurationMinutes / quotaMinutes) * 100)) : 0

    // Check if user is on LOA
    const activeLoa = await getActiveLeave(session.user.id, serverId)
    const isOnLoa = !!activeLoa

    // Check if user has admin access
    const hasAdminAccess = await isServerAdmin(session.user, serverId)

    // Reusable components for both layouts
    const ShiftSection = (
        <div className="rounded-xl bg-[#1a1a1a] p-4 text-center space-y-4 border border-[#333] bg-gradient-to-b from-[#1a1a1a] to-[#151515]">
            <ShiftButton isActive={!!myShift} serverId={serverId} disabled={isOnLoa} />
            {myShift && <ShiftTimer serverId={serverId} initialStartTime={myShift.startTime} quotaMinutes={quotaMinutes} weeklyMinutes={weeklyDurationMinutes} />}
            {!myShift && <ShiftTimer serverId={serverId} initialStartTime={null} quotaMinutes={quotaMinutes} weeklyMinutes={weeklyDurationMinutes} />}
            {!myShift && !isOnLoa && (
                <div className="text-xs text-zinc-400 border-t border-white/5 pt-4 mt-2">
                    <div className="flex justify-between items-center mb-1">
                        <span>Weekly Quota</span>
                        <span className={weeklyDurationMinutes >= quotaMinutes && quotaMinutes > 0 ? "text-emerald-400" : "text-zinc-300"}>
                            {Math.floor(weeklyDurationMinutes / 60)}h {weeklyDurationMinutes % 60}m
                            {quotaMinutes > 0 ? ` / ${Math.floor(quotaMinutes / 60)}h ${quotaMinutes % 60}m` : ""}
                        </span>
                    </div>
                    {quotaMinutes > 0 ? (
                        <div className="space-y-1">
                            <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${quotaProgress >= 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
                                    style={{ width: `${quotaProgress}%` }}
                                ></div>
                            </div>
                            <div className="text-[10px] text-right">
                                <span className={quotaProgress >= 100 ? "text-emerald-400 font-medium" : "text-zinc-500"}>
                                    {quotaProgress}% {quotaProgress >= 100 ? "✓" : ""}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-[10px] text-zinc-600">No quota set for your role</div>
                    )}
                </div>
            )}
            {(server as any)?.featureLoa && isOnLoa && activeLoa && (
                <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-3 flex items-center gap-3 text-left">
                    <Calendar className="h-5 w-5 text-orange-400 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-orange-400">You're on LOA</p>
                        <p className="text-xs text-orange-400/70">
                            Until {new Date(activeLoa.endDate).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            )}
        </div>
    )

    const PlayersSection = (
        <div className="rounded-xl bg-gradient-to-br from-[#1a1a1a] to-[#222] p-4 border border-[#333] flex-1 flex flex-col overflow-hidden">
            <ServerStatsHeader
                serverId={serverId}
                initialPlayers={serverStats.players}
                initialMaxPlayers={serverStats.maxPlayers}
                initialOnline={serverStats.online}
            />
            <PlayerManager serverId={serverId} />
        </div>
    )

    const LogsSection = permissions.canViewLogs ? (
        <LogViewer serverId={serverId} compact={true} />
    ) : null

    const PunishmentsSection = (
        <PunishmentList serverId={serverId} initialPunishments={recentPunishments} />
    )

    const ToolboxSection = (
        <Toolbox
            serverId={serverId}
            isOnLoa={isOnLoa}
            featureLoa={server.featureLoa}
            featureStaffReq={server.featureStaffReq}
            featurePermLog={server.featurePermLog}
        />
    )

    const MobileToolboxSection = (
        <MobileToolbox
            serverId={serverId}
            isOnLoa={isOnLoa}
            featureLoa={server.featureLoa}
            featureStaffReq={server.featureStaffReq}
            featurePermLog={server.featurePermLog}
        />
    )

    return (
        <EnsureDiscordConnection>
            <ServerEventsProvider serverId={serverId}>
                <SsdNotification serverId={serverId} />
                <ModCallDetector serverId={serverId} userRobloxId={session.user.robloxId || null} />
                <RoleSyncWrapper serverId={serverId}>
                    {/* MOBILE LAYOUT */}
                    <div className="md:hidden flex flex-col h-screen">
                        <WarningBanner />
                        <div className="flex-1 min-h-0">
                            <MobileModPanel
                                serverId={serverId}
                                hasAdminAccess={hasAdminAccess}
                                isOnDuty={!!myShift}
                                userName={session.user.name || session.user.username || "User"}
                                children={{
                                    header: null,
                                    shiftSection: ShiftSection,
                                    players: PlayersSection,
                                    logs: LogsSection,
                                    punishments: PunishmentsSection,
                                    toolbox: MobileToolboxSection,
                                }}
                            />
                        </div>
                    </div>

                    {/* DESKTOP LAYOUT */}
                    <div className="hidden md:flex flex-col h-screen bg-[#111] text-zinc-100 font-sans overflow-hidden">
                        <WarningBanner />
                        <div className="flex flex-col flex-1 min-h-0 p-4 overflow-hidden">
                            {/* Header */}
                            <div className="flex h-16 items-center justify-between border-b border-white/5 bg-[#1a1a1a] px-6 rounded-t-xl mb-4 flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                        <img src={session.user.image} alt="User" className="rounded-full" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-white">Hey, {session.user.name || session.user.username}!</h2>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className={`h-2 w-2 rounded-full ${myShift ? "bg-emerald-500" : "bg-red-500"}`}></span>
                                            <span className="font-bold text-zinc-400">{myShift ? "ON DUTY" : "OFF DUTY"}</span>
                                            {(member?.role?.canViewOtherShifts || hasAdminAccess) && (
                                                <StaffOnDutyAvatars serverId={serverId} excludeUserId={session.user.id} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {/* Header Buttons */}
                                <div className="flex items-center gap-3">
                                    {hasAdminAccess && (
                                        <Link
                                            href={`/dashboard/${serverId}/admin`}
                                            className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
                                        >
                                            <Settings className="h-4 w-4" />
                                            Admin Panel
                                        </Link>
                                    )}
                                    {hasAdminAccess && (
                                        <Link
                                            href={`/dashboard/${serverId}/forms`}
                                            className="flex items-center gap-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                                        >
                                            <FileText className="h-4 w-4" />
                                            Forms
                                        </Link>
                                    )}
                                    <a href="/dashboard" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors">
                                        Back to Dashboard
                                    </a>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 xl:grid-cols-5 flex-1 min-h-0">

                                {/* LEFT COLUMN: Toolbox (Fixed width if needed, or col-span-1) */}
                                <div className="lg:col-span-1 flex flex-col gap-4 h-full min-h-0">
                                    {/* LOA Banner */}
                                    {(server as any)?.featureLoa && isOnLoa && activeLoa && (
                                        <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-4 flex items-center gap-3 flex-shrink-0">
                                            <Calendar className="h-5 w-5 text-orange-400" />
                                            <div>
                                                <p className="text-sm font-medium text-orange-400">You're on LOA</p>
                                                <p className="text-xs text-orange-400/70">
                                                    Until {new Date(activeLoa.endDate).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Shift Button & Timer */}
                                    <div className="rounded-xl bg-[#1a1a1a] p-4 text-center space-y-4 border border-[#333] bg-gradient-to-b from-[#1a1a1a] to-[#151515] flex-shrink-0">
                                        <ShiftButton isActive={!!myShift} serverId={serverId} disabled={isOnLoa} />
                                        {myShift && <ShiftTimer serverId={serverId} initialStartTime={myShift.startTime} quotaMinutes={quotaMinutes} weeklyMinutes={weeklyDurationMinutes} />}
                                        {!myShift && <ShiftTimer serverId={serverId} initialStartTime={null} quotaMinutes={quotaMinutes} weeklyMinutes={weeklyDurationMinutes} />}
                                        {!myShift && !isOnLoa && (
                                            <div className="text-xs text-zinc-400 border-t border-white/5 pt-4 mt-2">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span>Weekly Quota</span>
                                                    <span className={weeklyDurationMinutes >= quotaMinutes && quotaMinutes > 0 ? "text-emerald-400" : "text-zinc-300"}>
                                                        {Math.floor(weeklyDurationMinutes / 60)}h {weeklyDurationMinutes % 60}m
                                                        {quotaMinutes > 0 ? ` / ${Math.floor(quotaMinutes / 60)}h ${quotaMinutes % 60}m` : ""}
                                                    </span>
                                                </div>
                                                {quotaMinutes > 0 ? (
                                                    <div className="space-y-1">
                                                        <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${quotaProgress >= 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
                                                                style={{ width: `${quotaProgress}%` }}
                                                            ></div>
                                                        </div>
                                                        <div className="text-[10px] text-right">
                                                            <span className={quotaProgress >= 100 ? "text-emerald-400 font-medium" : "text-zinc-500"}>
                                                                {quotaProgress}% {quotaProgress >= 100 ? "✓" : ""}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] text-zinc-600">No quota set for your role</div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Players Status - Flex grow to fill remaining height */}
                                    <div className="rounded-xl bg-gradient-to-br from-[#1a1a1a] to-[#222] p-4 border border-[#333] flex-1 flex flex-col overflow-hidden">
                                        <ServerStatsHeader
                                            serverId={serverId}
                                            initialPlayers={serverStats.players}
                                            initialMaxPlayers={serverStats.maxPlayers}
                                            initialOnline={serverStats.online}
                                        />
                                        <PlayerManager serverId={serverId} />
                                    </div>
                                </div>

                                {/* MIDDLE COLUMN: Toolbox + Logs (Wider) */}
                                <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-4 h-full min-h-0">
                                    {/* Toolbox Bar */}
                                    {/* Toolbox Bar - Gated in component but also hide if needed */}
                                    <Toolbox
                                        serverId={serverId}
                                        isOnLoa={isOnLoa}
                                        featureLoa={(server as any).featureLoa}
                                        featureStaffReq={(server as any).featureStaffReq}
                                        featurePermLog={(server as any).featurePermLog}
                                    />

                                    {/* Logs Panel */}
                                    {/* Logs Panel - Gated */}
                                    {permissions.canViewLogs && (
                                        <div className="flex-1 flex flex-col min-h-0 bg-[#1a1a1a] rounded-xl overflow-hidden border border-[#222] relative">
                                            <div className="p-4 border-b border-[#2a2a2a]">
                                                <h3 className="font-bold text-white">Live Logs</h3>
                                            </div>
                                            <div className="flex-1 overflow-hidden p-0">
                                                {/* We reuse the Logic of LogViewer but likely need to strip its internal container styling to fit here seamlessly */}
                                                <LogViewer serverId={serverId} compact={true} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* RIGHT COLUMN: Punishments */}
                                <div className="lg:col-span-1 flex flex-col h-full min-h-0 bg-[#1a1a1a] rounded-xl overflow-hidden border border-[#222]">
                                    <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between flex-shrink-0">
                                        <h3 className="font-bold text-white">Punishments</h3>
                                        <Filter className="h-4 w-4 text-zinc-500" />
                                    </div>
                                    <PunishmentList serverId={serverId} initialPunishments={recentPunishments} />
                                </div>
                            </div>
                        </div>
                    </div>
                </RoleSyncWrapper>
            </ServerEventsProvider>
        </EnsureDiscordConnection>
    )
}