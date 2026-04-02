import { Client } from "discord.js"
import { getGlobalConfig } from "../lib/config"

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000"
const INTERNAL_SECRET = process.env.INTERNAL_SYNC_SECRET!

let isSyncing = false // Overlap protection

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
    } catch (e: any) {
        // Suppress connection refused errors during dev if dashboard is down
        if (e.cause?.code === "ECONNREFUSED") return
        if (e.name === "AbortError") {
            console.error("Failed to sync logs: sync cycle timed out (30s)")
            return
        }
        console.error("Failed to sync logs:", e.message)
    } finally {
        isSyncing = false
    }
}

