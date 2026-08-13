import { prisma } from "@/lib/db"
import { fetchAndSaveLogs } from "@/lib/log-syncer"
import { trackSyncCycle } from "@/lib/metrics"
import { getServerSettings } from "@/lib/server-settings"
import { maybeRunDataCleanup } from "@/lib/data-cleanup"
import { sendAlert } from "@/lib/alerting"
import { healthState } from "@/lib/health-state"
import { PrcInvalidKeyError } from "@/lib/prc"
import { NextResponse } from "next/server"
import crypto from "crypto"
import { newCorrelationId, runWithCorrelationId } from "@/lib/request-context"
import { createLogger } from "@/lib/logger"

const log = createLogger("sync-route")

const INTERNAL_SECRET = process.env.INTERNAL_SYNC_SECRET!

// Cycles run every ~4s per server — 15 consecutive failures ≈ 1 minute of
// continuous breakage before we page.
const SYNC_FAILURE_ALERT_THRESHOLD = 15

export async function POST(req: Request) {
    const authHeader = req.headers.get("x-internal-secret")

    if (!INTERNAL_SECRET || !authHeader || authHeader.length !== INTERNAL_SECRET.length || !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(INTERNAL_SECRET))) {
        console.error("[SYNC 401] Unauthorized")
        return new NextResponse("Unauthorized", { status: 401 })
    }

    try {
        const body = await req.json().catch(() => ({}))
        const { serverId } = body

        let servers = []

        if (serverId) {
            const s = await prisma.server.findUnique({ where: { id: serverId } })
            if (s) servers.push(s)
        } else {
            servers = await prisma.server.findMany({
                where: {
                    apiUrl: { not: "" }
                }
            })
        }

        const syncResults: { serverId: string; newLogs: number }[] = []

        for (const server of servers) {
            if (!server.apiUrl) continue

            // Fresh correlation ID per server per cycle — propagates through
            // fetchAndSaveLogs -> event-bus.ts -> any synchronous SSE
            // subscriber callbacks automatically via AsyncLocalStorage, so a
            // single Loki query on this ID reconstructs the whole
            // PRC-poll -> DB-write -> SSE-emit chain for one cycle.
            await runWithCorrelationId(newCorrelationId(), async () => {
                const syncStart = Date.now()
                const cycleLog = log.child({ serverId: server.id })
                cycleLog.debug("sync cycle starting")
                try {
                    const res = await fetchAndSaveLogs(server.apiUrl, server.id)

                    // Tick automations (time-based)
                    const { AutomationEngine } = await import("@/lib/automation-engine")
                    await AutomationEngine.tick(server.id)

                    // Run data retention cleanup (throttled to once per day per server)
                    const serverSettings = await getServerSettings(server.id)
                    maybeRunDataCleanup(server.id, serverSettings.dataRetentionDays).catch(e =>
                        console.error(`[SYNC] Cleanup error for ${server.id}:`, e)
                    )

                    trackSyncCycle(server.id, Date.now() - syncStart, res.newLogsCount, "ok")
                    syncResults.push({ serverId: server.id, newLogs: res.newLogsCount })
                    cycleLog.debug("sync cycle ok", { newLogs: res.newLogsCount, durationMs: Date.now() - syncStart })

                    healthState.lastSyncOkAt = Date.now()
                    const failures = healthState.consecutiveSyncFailures.get(server.id) || 0
                    if (failures >= SYNC_FAILURE_ALERT_THRESHOLD) {
                        sendAlert({
                            key: `sync-recovered:${server.id}`,
                            title: "Log sync recovered",
                            message: `Sync for **${server.name || server.id}** is working again after ${failures} consecutive failures.`,
                            severity: "info",
                            cooldownMs: 0,
                        })
                    }
                    healthState.consecutiveSyncFailures.set(server.id, 0)
                } catch (e: any) {
                    trackSyncCycle(server.id, Date.now() - syncStart, 0, "error", e.message)
                    // Log but don't stop the whole sync for one server failure
                    cycleLog.error("sync cycle failed", { err: e, durationMs: Date.now() - syncStart })

                    const failures = (healthState.consecutiveSyncFailures.get(server.id) || 0) + 1
                    healthState.consecutiveSyncFailures.set(server.id, failures)

                    if (e instanceof PrcInvalidKeyError) {
                        // Known-dead key — the client itself now short-circuits further
                        // requests for this key, so this isn't a transient failure that
                        // will clear on its own. Alert immediately (don't wait for the
                        // generic threshold) so staff can rotate the key rather than
                        // leaving the mod panel silently stale.
                        sendAlert({
                            key: `sync-invalid-key:${server.id}`,
                            title: "PRC Server-Key invalid — sync disabled",
                            message: `Sync for **${server.name || server.id}** stopped because PRC returned 403 (invalid Server-Key). To avoid risking an IP ban from repeated invalid-key requests, we will not retry this server until its key is updated.\n\nHave the server owner regenerate their key in-game and re-enter it in POW settings.`,
                            severity: "critical",
                            cooldownMs: 60 * 60 * 1000,
                            fields: { serverId: server.id },
                        })
                    } else if (failures === SYNC_FAILURE_ALERT_THRESHOLD) {
                        sendAlert({
                            key: `sync-fail:${server.id}`,
                            title: "Log sync failing",
                            message: `Sync for **${server.name || server.id}** has failed ${failures} times in a row (~1 min). Mod panels for this server are stale.\n\`\`\`${String(e.message).slice(0, 500)}\`\`\``,
                            severity: "critical",
                            fields: { serverId: server.id },
                        })
                    }
                }
            })
        }
        healthState.lastSyncAt = Date.now()

        return NextResponse.json({ success: true, results: syncResults })
    } catch (e: any) {
        return new NextResponse(e.message, { status: 500 })
    }
}

