import { getSession } from "@/lib/auth-clerk"
import { isSuperAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import os from "os"

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

    // VPS system stats (synchronous — no I/O)
    const cpuCount = os.cpus().length
    const loadAvg = os.loadavg() // [1m, 5m, 15m]
    const cpuLoadPct = Math.min(100, Math.round((loadAvg[0] / cpuCount) * 100))
    const totalMemBytes = os.totalmem()
    const freeMemBytes = os.freemem()
    const usedMemBytes = totalMemBytes - freeMemBytes
    const memUsedPct = Math.round((usedMemBytes / totalMemBytes) * 100)
    const processRssBytes = process.memoryUsage().rss
    const processUptimeSeconds = Math.round(process.uptime())

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
        activeServers,
        lastSyncRecord,
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
        prisma.playerLocation.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
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
        queryPostHogLatency("prc"),
        queryPostHogLatency("pow-api"),
        querySyncHealth(),
    ])

    const byType = (groups: { type: string; _count: { id: number } }[], type: string) =>
        groups.find((g) => g.type === type)?._count.id ?? 0

    const lastSyncAgeSeconds = lastSyncRecord
        ? Math.round((now.getTime() - lastSyncRecord.createdAt.getTime()) / 1000)
        : null
    const staleServers = totalServers - activeServers.length

    const alerts = {
        emergencyActive: emergencyCallsHour > 0,
        syncStale: lastSyncAgeSeconds !== null && lastSyncAgeSeconds > 60,
        dbSlow: dbLatencyMs > 300,
        prcSlow: prcLatency !== null && prcLatency.avgMs > 2000,
        prcErrors: prcLatency !== null && prcLatency.errorRate > 15,
        syncUnhealthy: syncHealth !== null && syncHealth.successRate < 90,
        manyServersDown: totalServers > 0 && staleServers > totalServers * 0.5,
        cpuHigh: cpuLoadPct > 85,
        memHigh: memUsedPct > 90,
    }

    return NextResponse.json({
        platform: {
            totalServers,
            activeServers: activeServers.length,
            staleServers,
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
        health: {
            dbLatencyMs,
            lastSyncAgeSeconds,
            staleServers,
            prcLatency,
            powApiLatency,
            syncHealth,
            processUptimeSeconds,
            vps: {
                cpuCount,
                cpuLoadPct,
                loadAvg1m: Math.round(loadAvg[0] * 100) / 100,
                loadAvg5m: Math.round(loadAvg[1] * 100) / 100,
                loadAvg15m: Math.round(loadAvg[2] * 100) / 100,
                totalMemMb: Math.round(totalMemBytes / 1024 / 1024),
                usedMemMb: Math.round(usedMemBytes / 1024 / 1024),
                freeMemMb: Math.round(freeMemBytes / 1024 / 1024),
                memUsedPct,
                processRssMb: Math.round(processRssBytes / 1024 / 1024),
            },
        },
        alerts,
        anyAlert: Object.values(alerts).some(Boolean),
        updatedAt: now.toISOString(),
    })
}
