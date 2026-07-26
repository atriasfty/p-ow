import PostHogClient from "./posthog"

/**
 * Lightweight metrics tracking via PostHog custom events.
 * All metrics use distinctId "pow-system" (system actor).
 *
 * Events:
 * - `metric_api_call` — External/internal API call timing
 * - `metric_sync_cycle` — Log sync cycle timing
 * - `metric_db_query` — Database query timing
 *
 * QUOTA-CONSCIOUS: every event carries a `weight` property = how many real
 * occurrences it represents. Consumers (admin status dashboard) must sum
 * weights, not count events.
 *
 * - api_call: errors/timeouts/slow calls always sent; fast OK calls sampled 1-in-20
 * - sync_cycle: errors sent immediately; OK cycles aggregated per server every 5 min
 * - db_query: aggregated per model.action every 60s; only slow groups emitted
 */

const SYSTEM_ACTOR = "pow-system"

const API_SLOW_MS = 1000
const API_SAMPLE_RATE = 20 // 1 in N fast OK calls is sent

const SYNC_FLUSH_INTERVAL_MS = 5 * 60 * 1000

const DB_FLUSH_INTERVAL_MS = 60 * 1000
const DB_SLOW_MS = 50
const DB_MAX_GROUPS_PER_FLUSH = 20
const MAX_DB_BUFFER_SIZE = 5000

// State survives HMR / module duplication
interface MetricsState {
    apiSampleCounters: Map<string, number>
    syncBuffer: Map<string, { cycles: number; totalMs: number; maxMs: number; newLogs: number }>
    syncFlushTimer: ReturnType<typeof setTimeout> | null
    dbBuffer: { model: string; action: string; duration: number }[]
    dbFlushTimer: ReturnType<typeof setTimeout> | null
}
const g = globalThis as unknown as { _powMetrics?: MetricsState }
const state: MetricsState = g._powMetrics || (g._powMetrics = {
    apiSampleCounters: new Map(),
    syncBuffer: new Map(),
    syncFlushTimer: null,
    dbBuffer: [],
    dbFlushTimer: null,
})

function capture(event: string, properties: Record<string, any>) {
    try {
        PostHogClient().capture({ distinctId: SYSTEM_ACTOR, event, properties })
    } catch {
        // Never let metrics crash the app
    }
}

export function trackApiCall(
    service: "prc" | "clerk" | "pow-api" | "roblox" | "posthog" | "rotector",
    endpoint: string,
    durationMs: number,
    status: "ok" | "error" | "timeout",
    errorMessage?: string,
    metadata?: Record<string, any>,
    statusCode?: number
) {
    try {
        let weight = 1

        // Fast successful calls are high-volume, low-signal — sample them.
        if (status === "ok" && durationMs < API_SLOW_MS) {
            const key = `${service}:${endpoint}`
            const count = (state.apiSampleCounters.get(key) || 0) + 1
            if (state.apiSampleCounters.size > 2000) state.apiSampleCounters.clear()
            if (count < API_SAMPLE_RATE) {
                state.apiSampleCounters.set(key, count)
                return
            }
            state.apiSampleCounters.set(key, 0)
            weight = API_SAMPLE_RATE
        }

        capture("metric_api_call", {
            service,
            endpoint,
            duration_ms: Math.round(durationMs),
            status,
            weight,
            error_message: errorMessage || null,
            timestamp_iso: new Date().toISOString(),
            http_status: statusCode || (status === "ok" ? 200 : 500),
            ...(metadata || {})
        })
    } catch {
        // Never let metrics crash the app
    }
}

export function trackSyncCycle(
    serverId: string,
    durationMs: number,
    newLogsCount: number,
    status: "ok" | "error",
    errorMessage?: string
) {
    try {
        // Errors are rare and actionable — send immediately.
        if (status === "error") {
            capture("metric_sync_cycle", {
                server_id: serverId,
                duration_ms: Math.round(durationMs),
                new_logs_count: newLogsCount,
                status,
                weight: 1,
                error_message: errorMessage || null,
                timestamp_iso: new Date().toISOString()
            })
            return
        }

        // OK cycles fire every ~4s per server — aggregate per server, flush every 5 min.
        const agg = state.syncBuffer.get(serverId) || { cycles: 0, totalMs: 0, maxMs: 0, newLogs: 0 }
        agg.cycles++
        agg.totalMs += durationMs
        agg.maxMs = Math.max(agg.maxMs, durationMs)
        agg.newLogs += newLogsCount
        state.syncBuffer.set(serverId, agg)

        if (!state.syncFlushTimer) {
            state.syncFlushTimer = setTimeout(() => {
                state.syncFlushTimer = null
                flushSyncMetrics()
            }, SYNC_FLUSH_INTERVAL_MS)
        }
    } catch {
        // Never let metrics crash the app
    }
}

function flushSyncMetrics() {
    for (const [serverId, agg] of state.syncBuffer) {
        capture("metric_sync_cycle", {
            server_id: serverId,
            duration_ms: Math.round(agg.totalMs / agg.cycles),
            max_duration_ms: Math.round(agg.maxMs),
            new_logs_count: agg.newLogs,
            status: "ok",
            weight: agg.cycles,
            timestamp_iso: new Date().toISOString()
        })
    }
    state.syncBuffer.clear()
}

export function trackDbQuery(model: string, action: string, durationMs: number) {
    state.dbBuffer.push({ model, action, duration: Math.round(durationMs) })

    // Cap buffer size to prevent unbounded memory growth
    if (state.dbBuffer.length >= MAX_DB_BUFFER_SIZE) {
        if (state.dbFlushTimer) clearTimeout(state.dbFlushTimer)
        state.dbFlushTimer = null
        flushDbMetrics()
        return
    }

    if (!state.dbFlushTimer) {
        state.dbFlushTimer = setTimeout(() => {
            state.dbFlushTimer = null
            flushDbMetrics()
        }, DB_FLUSH_INTERVAL_MS)
    }
}

function flushDbMetrics() {
    if (state.dbBuffer.length === 0) return

    try {
        // Aggregate: avg duration per model.action
        const groups = new Map<string, { total: number; count: number; max: number }>()
        let overallTotal = 0
        for (const m of state.dbBuffer) {
            const key = `${m.model}.${m.action}`
            const gr = groups.get(key) || { total: 0, count: 0, max: 0 }
            gr.total += m.duration
            gr.count++
            gr.max = Math.max(gr.max, m.duration)
            groups.set(key, gr)
            overallTotal += m.duration
        }

        // One overall summary event so total query volume/latency is still visible
        capture("metric_db_query", {
            query: "__overall__",
            avg_duration_ms: Math.round(overallTotal / state.dbBuffer.length),
            max_duration_ms: Math.max(...state.dbBuffer.map(m => m.duration)),
            count: state.dbBuffer.length,
            timestamp_iso: new Date().toISOString()
        })

        // Per-query events only for slow groups (the ones worth looking at)
        const slow = Array.from(groups.entries())
            .filter(([, gr]) => gr.max >= DB_SLOW_MS)
            .sort(([, a], [, b]) => b.max - a.max)
            .slice(0, DB_MAX_GROUPS_PER_FLUSH)

        for (const [key, gr] of slow) {
            capture("metric_db_query", {
                query: key,
                avg_duration_ms: Math.round(gr.total / gr.count),
                max_duration_ms: gr.max,
                count: gr.count,
                timestamp_iso: new Date().toISOString()
            })
        }
    } catch {
        // Never let metrics crash the app
    }

    state.dbBuffer = []
}
