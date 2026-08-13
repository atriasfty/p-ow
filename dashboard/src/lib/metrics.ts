import {
    apiCallDuration,
    apiCallErrors,
    dbQueryDuration,
    syncCycleDuration,
    syncCycleNewLogs,
    syncCycleFailures,
    lastSyncTimestamp,
} from "./prometheus"

/**
 * Ops metrics, recorded directly into Prometheus histograms/counters (see
 * ./prometheus.ts). No sampling or buffering — that complexity used to live
 * here to survive PostHog's event quota, but Prometheus at POW's request
 * volume needs none of it: every call is a plain observe()/inc().
 *
 * PostHog is still used separately for exception tracking (see errors.ts) —
 * this file is ops metrics only.
 */

export function trackApiCall(
    service: "prc" | "clerk" | "pow-api" | "roblox" | "posthog" | "rotector",
    endpoint: string,
    durationMs: number,
    status: "ok" | "error" | "timeout",
    _errorMessage?: string,
    _metadata?: Record<string, any>,
    statusCode?: number
) {
    try {
        apiCallDuration.labels(service, status).observe(durationMs / 1000)
        if (status !== "ok") {
            apiCallErrors.labels(service, String(statusCode || 500)).inc()
        }
    } catch {
        // Never let metrics crash the app
    }
}

export function trackSyncCycle(
    serverId: string,
    durationMs: number,
    newLogsCount: number,
    status: "ok" | "error",
    _errorMessage?: string
) {
    try {
        syncCycleDuration.labels(serverId).observe(durationMs / 1000)
        if (status === "error") {
            syncCycleFailures.labels(serverId).inc()
        } else {
            syncCycleNewLogs.labels(serverId).inc(newLogsCount)
            lastSyncTimestamp.labels(serverId).set(Date.now() / 1000)
        }
    } catch {
        // Never let metrics crash the app
    }
}

export function trackDbQuery(model: string, action: string, durationMs: number) {
    try {
        dbQueryDuration.labels(model, action).observe(durationMs / 1000)
    } catch {
        // Never let metrics crash the app
    }
}
