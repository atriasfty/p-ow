import { Client } from "discord.js"
import { getGlobalConfig } from "../lib/config"
import { sendAlert } from "../lib/alerting"

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000"
const INTERNAL_SECRET = process.env.INTERNAL_SYNC_SECRET!

let isSyncing = false // Overlap protection

// This loop is the heartbeat of the whole platform — if it can't reach the
// dashboard, every server's log sync is down. Alert after ~1 min of failures.
const DRIVER_FAILURE_ALERT_THRESHOLD = 15
let consecutiveDriverFailures = 0

function recordDriverResult(ok: boolean, errorMessage?: string) {
    if (ok) {
        if (consecutiveDriverFailures >= DRIVER_FAILURE_ALERT_THRESHOLD) {
            sendAlert({
                key: "log-sync-driver:recovered",
                title: "Log sync driver recovered",
                message: `Dashboard sync endpoint reachable again after ${consecutiveDriverFailures} consecutive failures.`,
                severity: "info",
                cooldownMs: 0,
            })
        }
        consecutiveDriverFailures = 0
        return
    }

    consecutiveDriverFailures++
    if (consecutiveDriverFailures === DRIVER_FAILURE_ALERT_THRESHOLD) {
        sendAlert({
            key: "log-sync-driver:failing",
            title: "Log sync driver failing",
            message: `The bot has failed to reach the dashboard sync endpoint ${consecutiveDriverFailures} times in a row (~1 min). ALL log syncing is down.\n\`\`\`${(errorMessage || "unknown error").slice(0, 500)}\`\`\``,
            severity: "critical",
        })
    }
}

export function startLogSyncService(client: Client) {
    console.log(`Starting log sync service (dynamic interval)`)

    async function schedule() {
        if (isSyncing) {
            setTimeout(schedule, 1000)
            return
        }

        try {
            await syncLogs()
        } catch (e) {
            console.error("Log sync service error:", e)
        }

        const interval = await getGlobalConfig("SYNC_INTERVAL_MS")
        setTimeout(schedule, interval)
    }

    schedule()
}

async function syncLogs() {
    isSyncing = true
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 120000) // 120s max per sync cycle (raised from 30s)

        const response = await fetch(`${DASHBOARD_URL}/api/internal/sync`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal-secret": INTERNAL_SECRET
            },
            body: JSON.stringify({}),
            signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
            throw new Error(`Sync failed with status: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        // Optional: Log success if needed, but keep it quiet to avoid spam
        // console.log(`[LOG SYNC] Synced ${data.results?.length || 0} servers`)
        recordDriverResult(true)
    } catch (e: any) {
        // Suppress connection refused noise in dev if dashboard is down —
        // in production a refused connection means the dashboard is DOWN.
        if (e.cause?.code === "ECONNREFUSED" && process.env.NODE_ENV !== "production") return
        if (e.name === "AbortError") {
            console.error("Failed to sync logs: sync cycle timed out (120s)")
            recordDriverResult(false, "sync cycle timed out (120s)")
            return
        }
        console.error("Failed to sync logs:", e.message)
        recordDriverResult(false, e.message)
    } finally {
        isSyncing = false
    }
}

