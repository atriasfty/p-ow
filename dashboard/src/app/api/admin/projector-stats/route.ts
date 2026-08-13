import { getSession } from "@/lib/auth-clerk"
import { isSuperAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { healthState } from "@/lib/health-state"
import os from "os"

// A server with zero players still syncs successfully every ~4s cycle —
// don't confuse "no recent player activity" with "sync pipeline broken".
const SYNC_STALE_MS = 90 * 1000

export const dynamic = "force-dynamic"

// Prometheus runs locally on the same box (see observability/) — a plain
// unauthenticated loopback call, same as everything else in this codebase
// that talks to it. This used to query PostHog's `metric_api_call` /
// `metric_sync_cycle` events, but metrics.ts stopped emitting those when it
// switched to recording straight into Prometheus (no more PostHog sampling
// needed at this volume) — this just follows that move.
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || "http://127.0.0.1:9090"

interface PhLatency { avgMs: number; errorRate: number; totalCalls: number }

async function promInstantQuery(query: string): Promise<string | null> {
    try {
        const res = await fetch(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`, {
            signal: AbortSignal.timeout(2500),
            cache: "no-store",
        })
        if (!res.ok) return null
        const data = await res.json()
        if (data.status !== "success") return null
        const value = data.data?.result?.[0]?.value?.[1]
        return value === undefined ? null : value
    } catch { return null }
}

async function queryPrcLatency(service: string, minutes = 5): Promise<PhLatency | null> {
    const range = `${minutes}m`
    const [totalCallsRaw, avgSecRaw, errCountRaw] = await Promise.all([
        promInstantQuery(`sum(increase(pow_api_call_duration_seconds_count{service="${service}"}[${range}]))`),
        promInstantQuery(`sum(increase(pow_api_call_duration_seconds_sum{service="${service}"}[${range}])) / sum(increase(pow_api_call_duration_seconds_count{service="${service}"}[${range}]))`),
        promInstantQuery(`sum(increase(pow_api_call_errors_total{service="${service}"}[${range}]))`),
    ])
    const totalCalls = Number(totalCallsRaw)
    if (!totalCallsRaw || !totalCalls) return null
    const avgSec = Number(avgSecRaw) || 0
    const errCount = Number(errCountRaw) || 0
    return {
        avgMs: Math.round(avgSec * 1000),
        errorRate: Math.round((errCount / totalCalls) * 100),
        totalCalls: Math.round(totalCalls),
    }
}

async function querySyncHealth(minutes = 5): Promise<{ successRate: number; totalCycles: number } | null> {
    const range = `${minutes}m`
    const [totalCyclesRaw, failuresRaw] = await Promise.all([
        promInstantQuery(`sum(increase(pow_sync_cycle_duration_seconds_count[${range}]))`),
        promInstantQuery(`sum(increase(pow_sync_cycle_failures_total[${range}]))`),
    ])
    const totalCycles = Number(totalCyclesRaw)
    if (!totalCyclesRaw || !totalCycles) return null
    const failures = Number(failuresRaw) || 0
    return {
        successRate: Math.round(((totalCycles - failures) / totalCycles) * 100),
        totalCycles: Math.round(totalCycles),
    }
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
        syncedServerIds,
        totalMembers,
        newMembersWeek,
        staffOnDuty,
        activeLoas,
        modCallsHour,
        emergencyCallsHour,
        activePlayers,
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
        // Only servers with a configured PRC key are actually synced (matches
        // api/internal/sync/route.ts's own filter) — anything else would
        // never get a healthState entry and would look permanently stale.
        prisma.server.findMany({ where: { apiUrl: { not: "" } }, select: { id: true } }),
        prisma.member.count(),
        prisma.member.count({ where: { createdAt: { gte: startOfWeek } } }),
        prisma.shift.count({ where: { endTime: null } }),
        prisma.leaveOfAbsence.count({
            where: { status: "approved", startDate: { lte: now }, endDate: { gte: now } },
        }),
        prisma.modCall.count({ where: { createdAt: { gte: oneHourAgo } } }),
        prisma.emergencyCall.count({ where: { createdAt: { gte: oneHourAgo } } }),
        prisma.playerLocation.groupBy({ by: ["userId"], where: { createdAt: { gte: recentWindow } } }),
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
        queryPrcLatency("prc"),
        queryPrcLatency("pow-api"),
        querySyncHealth(),
    ])

    const byType = (groups: { type: string; _count: { id: number } }[], type: string) =>
        groups.find((g) => g.type === type)?._count.id ?? 0

    // healthState.lastSyncOkAt/lastSyncOkAtByServer are set on every
    // successful sync cycle regardless of newLogsCount — unlike the old
    // PlayerLocation-based check, an empty (no-player) server that's syncing
    // fine won't be misread as stale here.
    const lastSyncAgeSeconds = healthState.lastSyncOkAt
        ? Math.round((now.getTime() - healthState.lastSyncOkAt) / 1000)
        : null
    const activeServerCount = syncedServerIds.filter((s: { id: string }) => {
        const lastOk = healthState.lastSyncOkAtByServer.get(s.id)
        return lastOk !== undefined && now.getTime() - lastOk < SYNC_STALE_MS
    }).length
    const staleServers = syncedServerIds.length - activeServerCount

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
            activeServers: activeServerCount,
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
