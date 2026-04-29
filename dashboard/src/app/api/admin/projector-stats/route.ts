import { getSession } from "@/lib/auth-clerk"
import { isSuperAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const POSTHOG_HOST = "https://a.atriasafety.org"

interface PhLatency { avgMs: number; errorRate: number; totalCalls: number }

async function queryPostHogLatency(service: string, minutes = 5): Promise<PhLatency | null> {
    const key = process.env.POSTHOG_PERSONAL_API_KEY
    const proj = process.env.POSTHOG_PROJECT_ID
    if (!key || !proj) return null

    const after = new Date(Date.now() - minutes * 60 * 1000).toISOString()
    // 403s are expected auth rejections — excluded from error rate
    const errorCondition = `properties.status != 'ok' AND toInt64OrZero(toString(properties.http_status)) != 403`
    try {
        const res = await fetch(`${POSTHOG_HOST}/api/projects/${proj}/query/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                query: {
                    kind: "HogQLQuery",
                    query: `SELECT avg(toFloat64OrZero(toString(properties.duration_ms))), countIf(${errorCondition}), count() FROM events WHERE event = 'metric_api_call' AND properties.service = '${service}' AND timestamp > toDateTime('${after}') LIMIT 1`
                }
            }),
            signal: AbortSignal.timeout(2500),
            cache: "no-store",
        })
        if (!res.ok) return null
        const data = await res.json()
        const row = data.results?.[0]
        if (!row || row[2] === 0) return null
        return { avgMs: Math.round(row[0] ?? 0), errorRate: Math.round((row[1] / row[2]) * 100), totalCalls: row[2] }
    } catch { return null }
}

async function querySyncHealth(minutes = 5): Promise<{ successRate: number; totalCycles: number } | null> {
    const key = process.env.POSTHOG_PERSONAL_API_KEY
    const proj = process.env.POSTHOG_PROJECT_ID
    if (!key || !proj) return null

    const after = new Date(Date.now() - minutes * 60 * 1000).toISOString()
    try {
        const res = await fetch(`${POSTHOG_HOST}/api/projects/${proj}/query/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                query: {
                    kind: "HogQLQuery",
                    query: `SELECT countIf(properties.status = 'ok'), count() FROM events WHERE event = 'metric_sync_cycle' AND timestamp > toDateTime('${after}') LIMIT 1`
                }
            }),
            signal: AbortSignal.timeout(2500),
            cache: "no-store",
        })
        if (!res.ok) return null
        const data = await res.json()
        const row = data.results?.[0]
        if (!row || row[1] === 0) return null
        return { successRate: Math.round((row[0] / row[1]) * 100), totalCycles: row[1] }
    } catch { return null }
}

export async function GET() {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (!isSuperAdmin(session.user as any)) return new NextResponse("Forbidden", { status: 403 })

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const recentWindow = new Date(now.getTime() - 30 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const twoHoursAgo = new Date(now.getTime() - 120 * 60 * 1000)

    // Live DB round-trip latency
    const dbPingStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const dbLatencyMs = Date.now() - dbPingStart

    const [
        totalServers,
        totalMembers,
        newMembersWeek,
        staffOnDuty,
        activeLoas,
        modCallsHour,
        emergencyCallsHour,
        activePlayers,
        activeServersRaw,
        staffedActiveServers,
        lastSyncRecord,
        logsToday,
        joinsToday,
        leavesToday,
        killsToday,
        joinsLastHour,
        joinsPrevHour,
        shiftsStartedToday,
        shiftDurationToday,
        punishmentsToday,
        punishmentsThisHour,
        punishmentsByTypeToday,
        punishmentsWeek,
        punishmentsByTypeWeek,
        botQueuePending,
        botQueueFailed,
        formSubmissionsToday,
        securityEventsToday,
        totalLogsAll,
        totalPunishmentsAll,
        totalShiftsAll,
        prcLatency,
        powApiLatency,
        syncHealth,
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
        // Which of those active servers has at least one active shift
        prisma.shift.groupBy({ by: ["serverId"], where: { endTime: null } }),
        prisma.playerLocation.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
        prisma.log.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.log.count({ where: { type: "join", isJoin: true, createdAt: { gte: startOfToday } } }),
        prisma.log.count({ where: { type: "join", isJoin: false, createdAt: { gte: startOfToday } } }),
        prisma.log.count({ where: { type: "kill", createdAt: { gte: startOfToday } } }),
        // Join rate trend: last hour vs the hour before
        prisma.log.count({ where: { type: "join", isJoin: true, createdAt: { gte: oneHourAgo } } }),
        prisma.log.count({ where: { type: "join", isJoin: true, createdAt: { gte: twoHoursAgo, lt: oneHourAgo } } }),
        prisma.shift.count({ where: { startTime: { gte: startOfToday } } }),
        prisma.shift.aggregate({
            where: { startTime: { gte: startOfToday }, endTime: { not: null } },
            _sum: { duration: true },
        }),
        prisma.punishment.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.punishment.count({ where: { createdAt: { gte: oneHourAgo } } }),
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
        prisma.botQueue.count({ where: { status: "PENDING" } }),
        prisma.botQueue.count({ where: { status: "FAILED", createdAt: { gte: oneHourAgo } } }),
        prisma.formResponse.count({ where: { submittedAt: { gte: startOfToday } } }),
        prisma.securityLog.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.log.count(),
        prisma.punishment.count(),
        prisma.shift.count(),
        queryPostHogLatency("prc"),
        queryPostHogLatency("pow-api"),
        querySyncHealth(),
    ])

    const byType = (groups: { type: string; _count: { id: number } }[], type: string) =>
        groups.find((g) => g.type === type)?._count.id ?? 0

    const activeServerIds = new Set(activeServersRaw.map((s) => s.serverId))
    const staffedServerIds = new Set(staffedActiveServers.map((s) => s.serverId))
    const unmannedServers = [...activeServerIds].filter((id) => !staffedServerIds.has(id)).length

    const lastSyncAgeSeconds = lastSyncRecord
        ? Math.round((now.getTime() - lastSyncRecord.createdAt.getTime()) / 1000)
        : null
    const staleServers = totalServers - activeServerIds.size

    // Join rate trend: positive = more joins this hour than last hour
    const joinTrendPct = joinsPrevHour > 0
        ? Math.round(((joinsLastHour - joinsPrevHour) / joinsPrevHour) * 100)
        : null

    const processUptimeSeconds = Math.round(process.uptime())

    const alerts = {
        emergencyActive: emergencyCallsHour > 0,
        unmannedServers: unmannedServers > 0,
        syncStale: lastSyncAgeSeconds !== null && lastSyncAgeSeconds > 60,
        dbSlow: dbLatencyMs > 300,
        prcSlow: prcLatency !== null && prcLatency.avgMs > 2000,
        prcErrors: prcLatency !== null && prcLatency.errorRate > 15,
        syncUnhealthy: syncHealth !== null && syncHealth.successRate < 90,
        manyServersDown: totalServers > 0 && staleServers > totalServers * 0.5,
        botQueueStuck: botQueuePending > 10 || botQueueFailed > 5,
    }

    return NextResponse.json({
        platform: {
            totalServers,
            activeServers: activeServerIds.size,
            staleServers,
            unmannedServers,
            totalMembers,
            newMembersWeek,
        },
        live: {
            activePlayers: activePlayers.length,
            staffOnDuty,
            activeLoas,
            modCallsHour,
            emergencyCallsHour,
            punishmentsThisHour,
            joinTrendPct,
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
            formSubmissions: formSubmissionsToday,
            securityEvents: securityEventsToday,
        },
        week: {
            punishments: punishmentsWeek,
            warns: byType(punishmentsByTypeWeek, "Warn"),
            kicks: byType(punishmentsByTypeWeek, "Kick"),
            bans: byType(punishmentsByTypeWeek, "Ban"),
            banBolos: byType(punishmentsByTypeWeek, "Ban Bolo"),
        },
        ops: {
            botQueuePending,
            botQueueFailed,
        },
        db: {
            totalLogs: totalLogsAll,
            totalPunishments: totalPunishmentsAll,
            totalShifts: totalShiftsAll,
        },
        health: {
            dbLatencyMs,
            lastSyncAgeSeconds,
            prcLatency,
            powApiLatency,
            syncHealth,
            staleServers,
            processUptimeSeconds,
        },
        alerts,
        anyAlert: Object.values(alerts).some(Boolean),
        updatedAt: now.toISOString(),
    })
}
