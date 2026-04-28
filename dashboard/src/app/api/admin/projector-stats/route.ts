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
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    // 30s window captures ~7 sync cycles (syncer runs every ~4s)
    const recentWindow = new Date(now.getTime() - 30 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    const [
        totalServers,
        totalMembers,
        newMembersWeek,
        staffOnDuty,
        activeLoas,
        modCallsHour,
        emergencyCallsHour,
        activePlayers,
        activeServers,
        logsToday,
        joinsToday,
        leavesToday,
        killsToday,
        shiftsStartedToday,
        shiftDurationToday,
        punishmentsToday,
        punishmentsByTypeToday,
        punishmentsWeek,
        punishmentsByTypeWeek,
        totalLogsAll,
        totalPunishmentsAll,
        totalShiftsAll,
    ] = await Promise.all([
        prisma.server.count(),
        prisma.member.count(),
        prisma.member.count({ where: { createdAt: { gte: startOfWeek } } }),
        prisma.shift.count({ where: { endTime: null } }),
        prisma.leaveOfAbsence.count({
            where: { status: "approved", startDate: { lte: now }, endDate: { gte: now } },
        }),
        prisma.modCall.count({ where: { createdAt: { gte: oneHourAgo } } }),
        prisma.emergencyCall.count({ where: { createdAt: { gte: oneHourAgo } } }),
        prisma.playerLocation.groupBy({ by: ["userId"], where: { createdAt: { gte: recentWindow } } }),
        prisma.playerLocation.groupBy({ by: ["serverId"], where: { createdAt: { gte: recentWindow } } }),
        prisma.log.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.log.count({ where: { type: "join", isJoin: true, createdAt: { gte: startOfToday } } }),
        prisma.log.count({ where: { type: "join", isJoin: false, createdAt: { gte: startOfToday } } }),
        prisma.log.count({ where: { type: "kill", createdAt: { gte: startOfToday } } }),
        prisma.shift.count({ where: { startTime: { gte: startOfToday } } }),
        prisma.shift.aggregate({
            where: { startTime: { gte: startOfToday }, endTime: { not: null } },
            _sum: { duration: true },
        }),
        prisma.punishment.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.punishment.groupBy({
            by: ["type"],
            where: { createdAt: { gte: startOfToday } },
            _count: { id: true },
        }),
        prisma.punishment.count({ where: { createdAt: { gte: startOfWeek } } }),
        prisma.punishment.groupBy({
            by: ["type"],
            where: { createdAt: { gte: startOfWeek } },
            _count: { id: true },
        }),
        prisma.log.count(),
        prisma.punishment.count(),
        prisma.shift.count(),
    ])

    const byType = (groups: { type: string; _count: { id: number } }[], type: string) =>
        groups.find((g) => g.type === type)?._count.id ?? 0

    return NextResponse.json({
        platform: {
            totalServers,
            activeServers: activeServers.length,
            totalMembers,
            newMembersWeek,
        },
        live: {
            activePlayers: activePlayers.length,
            staffOnDuty,
            activeLoas,
            modCallsHour,
            emergencyCallsHour,
        },
        today: {
            logs: logsToday,
            joins: joinsToday,
            leaves: leavesToday,
            kills: killsToday,
            punishments: punishmentsToday,
            shiftsStarted: shiftsStartedToday,
            shiftDurationSeconds: shiftDurationToday._sum.duration ?? 0,
            warns: byType(punishmentsByTypeToday, "Warn"),
            kicks: byType(punishmentsByTypeToday, "Kick"),
            bans: byType(punishmentsByTypeToday, "Ban"),
            banBolos: byType(punishmentsByTypeToday, "Ban Bolo"),
        },
        week: {
            punishments: punishmentsWeek,
            warns: byType(punishmentsByTypeWeek, "Warn"),
            kicks: byType(punishmentsByTypeWeek, "Kick"),
            bans: byType(punishmentsByTypeWeek, "Ban"),
            banBolos: byType(punishmentsByTypeWeek, "Ban Bolo"),
        },
        db: {
            totalLogs: totalLogsAll,
            totalPunishments: totalPunishmentsAll,
            totalShifts: totalShiftsAll,
        },
        updatedAt: now.toISOString(),
    })
}
