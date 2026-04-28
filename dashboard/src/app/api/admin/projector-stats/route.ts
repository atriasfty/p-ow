import { getSession } from "@/lib/auth-clerk"
import { isSuperAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (!isSuperAdmin(session.user as any)) return new NextResponse("Forbidden", { status: 403 })

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    // 30s window captures ~7 sync cycles (syncer runs every ~4s per server)
    const recentWindow = new Date(now.getTime() - 30 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    const [
        totalServers,
        totalMembers,
        staffOnDuty,
        logsToday,
        punishmentsToday,
        activePlayers,
        activeServers,
        activeModCalls,
        activeEmergencyCalls,
    ] = await Promise.all([
        prisma.server.count(),
        prisma.member.count(),
        prisma.shift.count({ where: { endTime: null } }),
        prisma.log.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.punishment.count({ where: { createdAt: { gte: startOfToday } } }),
        // Distinct players seen in last 30s (userId = Roblox player ID)
        prisma.playerLocation.groupBy({
            by: ["userId"],
            where: { createdAt: { gte: recentWindow } },
        }),
        // Distinct servers with player activity in last 30s
        prisma.playerLocation.groupBy({
            by: ["serverId"],
            where: { createdAt: { gte: recentWindow } },
        }),
        prisma.modCall.count({ where: { createdAt: { gte: oneHourAgo } } }),
        prisma.emergencyCall.count({ where: { createdAt: { gte: oneHourAgo } } }),
    ])

    return NextResponse.json({
        platform: {
            totalServers,
            activeServers: activeServers.length,
            totalMembers,
            staffOnDuty,
            activePlayers: activePlayers.length,
            logsToday,
            punishmentsToday,
            activeModCalls,
            activeEmergencyCalls,
        },
        updatedAt: now.toISOString(),
    })
}
