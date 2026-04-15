
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { redirect } from "next/navigation"
import { clerkClient } from "@clerk/nextjs/server"
import { Clock, Trophy, User, CheckCircle, XCircle, Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

interface ClerkUser {
    id: string
    username: string | null
    name: string | null
    image: string
    discordId?: string
    robloxId?: string
    robloxUsername?: string
}

export default async function AdminQuotaPage({
    params,
    searchParams
}: {
    params: Promise<{ serverId: string }>,
    searchParams: Promise<{ week?: string }>
}) {
    const session = await getSession()
    if (!session) redirect("/login")

    const { serverId } = await params
    const { week: weekParam } = await searchParams

    const hasAccess = await isServerAdmin(session.user, serverId)
    if (!hasAccess) redirect(`/dashboard/${serverId}/mod-panel`)

    // Get week offset from URL (0 = current week, -1 = last week, etc.)
    const weekOffset = parseInt(weekParam || "0")
    const isCurrentWeek = weekOffset === 0

    // Get all members with their roles
    const members = await prisma.member.findMany({
        where: { serverId },
        include: { role: true }
    })

    // Fetch Clerk users only for server members
    const client = await clerkClient()
    const uniqueUserIds = Array.from(new Set(members.map((m: any) => m.userId as string)))
    const clerkUsers: ClerkUser[] = []

    if (uniqueUserIds.length > 0) {
        // Chunk requests to handle Clerk's 100 limit per request
        const chunks: string[][] = []
        for (let i = 0; i < uniqueUserIds.length; i += 100) {
            chunks.push(uniqueUserIds.slice(i, i + 100) as string[])
        }

        const responses = await Promise.all(
            chunks.map((chunk: string[]) => client.users.getUserList({ userId: chunk, limit: 100 }))
        )

        responses.forEach(response => {
            const mappedUsers = response.data.map(user => {
                const discordAccount = user.externalAccounts.find(
                    a => (a.provider as string) === "discord" || (a.provider as string) === "oauth_discord"
                )
                const robloxAccount = user.externalAccounts.find(
                    a => ["roblox", "oauth_roblox", "oauth_custom_roblox", "custom_roblox"].includes(a.provider as string)
                )

                return {
                    id: user.id,
                    username: user.username,
                    name: user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.firstName || user.username,
                    image: user.imageUrl,
                    discordId: discordAccount?.externalId,
                    robloxId: robloxAccount?.externalId,
                    robloxUsername: robloxAccount?.username || undefined
                }
            })
            clerkUsers.push(...mappedUsers)
        })
    }

    // Helper to get Roblox username for a userId
    const getRobloxUsername = (userId: string): string => {
        const user = clerkUsers.find(u =>
            u.id === userId ||
            u.discordId === userId ||
            u.robloxId === userId
        )

        if (user?.robloxUsername) return user.robloxUsername
        if (user?.name || user?.username) return user.name || user.username || userId
        return userId
    }

    // Helper to get user avatar
    const getUserAvatar = (userId: string): string | null => {
        const user = clerkUsers.find(u =>
            u.id === userId ||
            u.discordId === userId ||
            u.robloxId === userId
        )
        return user?.image || null
    }

    // Calculate week start based on offset (Monday)
    const now = new Date()
    const currentDay = now.getDay()
    const currentDiff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1)
    const weekStart = new Date(now)
    weekStart.setDate(currentDiff + (weekOffset * 7))
    weekStart.setHours(0, 0, 0, 0)

    // Calculate week end
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    // Get shifts for this week - across ALL servers for global quota
    const shifts = await prisma.shift.findMany({
        where: {
            startTime: { gte: weekStart, lt: weekEnd }
        }
    })

    // Get LOAs that were active during the selected week
    const activeLoas = await prisma.leaveOfAbsence.findMany({
        where: {
            serverId,
            status: "approved",
            startDate: { lte: weekEnd },
            endDate: { gte: weekStart }
        }
    })
    const onLoaUserIds = new Set(activeLoas.map((l: any) => l.userId))

    // Deduplicate members and aggregate stats
    const uniqueUserStats = new Map<string, {
        memberId: string
        userId: string
        displayName: string
        avatar: string | null
        role: typeof members[0]['role']
        totalMinutes: number
        quotaRequired: number
        isOnLoa: boolean
        metQuota: boolean
    }>()

    // Helper to find canonical user ID (Clerk ID prefered)
    const getCanonicalId = (id: string) => {
        const u = clerkUsers.find(u => u.id === id || u.discordId === id || u.robloxId === id)
        return u ? u.id : id
    }

    for (const member of members) {
        const canonicalId = getCanonicalId(member.userId)

        // Calculate shift time for this specific member record
        const memberShifts = shifts.filter((s: any) => s.userId === member.userId)
        const totalMinutes = Math.floor(memberShifts.reduce((acc: number, s: any) => acc + (s.duration || 0), 0) / 60)

        const existing = uniqueUserStats.get(canonicalId)
        const currentRole = member.role

        // Determine if we should update the "primary" role/display info
        // We prefer the record that is actually the Clerk ID (if applicable) or if it has a higher quota?
        // Let's prefer the one linked to Clerk, or update if we find a role and didn't have one.
        const isClerkRecord = member.userId === canonicalId
        const shouldUpdateInfo = !existing || isClerkRecord || (!existing.role && currentRole)

        uniqueUserStats.set(canonicalId, {
            memberId: shouldUpdateInfo ? member.id : existing!.memberId,
            userId: canonicalId,
            displayName: shouldUpdateInfo ? getRobloxUsername(member.userId) : existing!.displayName,
            avatar: shouldUpdateInfo ? getUserAvatar(member.userId) : existing!.avatar,
            role: shouldUpdateInfo ? currentRole : (existing!.role || currentRole),
            totalMinutes: (existing?.totalMinutes || 0) + totalMinutes,
            // We'll update quota/status based on the final aggregated role/time below
            quotaRequired: 0,
            isOnLoa: onLoaUserIds.has(member.userId) || (existing?.isOnLoa || false),
            metQuota: false
        })
    }

    // Final pass to calculate status based on aggregated data
    const memberStats = Array.from(uniqueUserStats.values()).map(stat => {
        const quotaRequired = stat.role?.quotaMinutes || 0
        const metQuota = stat.isOnLoa || stat.totalMinutes >= quotaRequired

        return {
            ...stat,
            id: stat.memberId, // For key prop
            quotaRequired,
            metQuota
        }
    })

    // Sort by total time for leaderboard
    const leaderboard = [...memberStats].sort((a, b) => b.totalMinutes - a.totalMinutes)

    const formatTime = (minutes: number) => {
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
    }

    return (
        <div className="space-y-8">
            {/* Header with Week Navigation */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div>
                        <h2 className="font-bold text-white">Quota Tracking</h2>
                        <p className="text-xs text-zinc-500">
                            {isCurrentWeek ? "Current Week" : `${Math.abs(weekOffset)} week${Math.abs(weekOffset) > 1 ? "s" : ""} ago`}
                        </p>
                    </div>
                </div>

                {/* Week Navigation */}
                <div className="flex items-center gap-2">
                    <Link
                        href={`/dashboard/${serverId}/admin/quota?week=${weekOffset - 1}`}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#222] text-zinc-300 hover:bg-[#333] hover:text-white transition-colors text-sm"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Link>

                    <div className="px-4 py-2 bg-[#1a1a1a] rounded-lg border border-[#333] text-center min-w-[160px]">
                        <div className="text-sm font-medium text-white">
                            {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {new Date(weekEnd.getTime() - 1).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                    </div>

                    {isCurrentWeek ? (
                        <div className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#222] text-zinc-600 cursor-not-allowed text-sm">
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </div>
                    ) : (
                        <Link
                            href={weekOffset === -1 ? `/dashboard/${serverId}/admin/quota` : `/dashboard/${serverId}/admin/quota?week=${weekOffset + 1}`}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#222] text-zinc-300 hover:bg-[#333] hover:text-white transition-colors text-sm"
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Link>
                    )}
                </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-[#1a1a1a] rounded-xl border border-[#222] overflow-hidden">
                <div className="p-4 border-b border-[#222] flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-400" />
                    <h3 className="font-medium text-white">Leaderboard</h3>
                </div>
                <div className="divide-y divide-[#222]">
                    {leaderboard.slice(0, 10).map((member, idx) => (
                        <div key={member.id} className="flex items-center gap-4 p-4 hover:bg-white/5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? "bg-amber-500 text-black" :
                                idx === 1 ? "bg-zinc-300 text-black" :
                                    idx === 2 ? "bg-amber-700 text-white" :
                                        "bg-[#333] text-zinc-400"
                                }`}>
                                {idx + 1}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    {member.avatar ? (
                                        <img src={member.avatar} alt="" className="h-6 w-6 rounded-full" />
                                    ) : (
                                        <div className="h-6 w-6 rounded-full bg-zinc-700 flex items-center justify-center">
                                            <User className="h-3 w-3 text-zinc-400" />
                                        </div>
                                    )}
                                    <span className="text-sm text-white">{member.displayName}</span>
                                    {member.isOnLoa && (
                                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-orange-500/10 text-orange-400">
                                            <Calendar className="h-3 w-3" />
                                            On LOA
                                        </span>
                                    )}
                                </div>
                                {member.role && (
                                    <span className="text-xs text-zinc-500" style={{ color: member.role.color }}>
                                        {member.role.name}
                                    </span>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-medium text-white">{formatTime(member.totalMinutes)}</div>
                                <div className="text-xs text-zinc-500">
                                    / {formatTime(member.quotaRequired)} quota
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quota Status Table */}
            <div className="bg-[#1a1a1a] rounded-xl border border-[#222] overflow-hidden">
                <div className="p-4 border-b border-[#222]">
                    <h3 className="font-medium text-white">All Members Quota Status</h3>
                </div>
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-[#222]">
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Member</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Role</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Time This Week</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Quota</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {memberStats.map(member => (
                            <tr key={member.id} className="border-b border-[#222] last:border-0 hover:bg-white/5">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        {member.avatar ? (
                                            <img src={member.avatar} alt="" className="h-6 w-6 rounded-full" />
                                        ) : (
                                            <div className="h-6 w-6 rounded-full bg-zinc-700 flex items-center justify-center">
                                                <User className="h-3 w-3 text-zinc-400" />
                                            </div>
                                        )}
                                        <span className="text-sm text-white">{member.displayName}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    {member.role ? (
                                        <span className="text-sm" style={{ color: member.role.color }}>
                                            {member.role.name}
                                        </span>
                                    ) : (
                                        <span className="text-sm text-zinc-500">No role</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm text-white">
                                    {formatTime(member.totalMinutes)}
                                </td>
                                <td className="px-4 py-3 text-sm text-zinc-400">
                                    {formatTime(member.quotaRequired)}
                                </td>
                                <td className="px-4 py-3">
                                    {member.isOnLoa ? (
                                        <span className="flex items-center gap-1 text-xs text-orange-400">
                                            <Calendar className="h-3 w-3" />
                                            On LOA
                                        </span>
                                    ) : member.metQuota ? (
                                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                                            <CheckCircle className="h-3 w-3" />
                                            Met
                                        </span>
                                    ) : member.quotaRequired > 0 ? (
                                        <span className="flex items-center gap-1 text-xs text-red-400">
                                            <XCircle className="h-3 w-3" />
                                            {formatTime(member.quotaRequired - member.totalMinutes)} remaining
                                        </span>
                                    ) : (
                                        <span className="text-xs text-zinc-500">No quota</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
