import client from "prom-client"
import { healthState } from "./health-state"

/**
 * Prometheus metrics registry for the dashboard process. Scraped by the
 * observability stack's Prometheus over /api/metrics (see route.ts next to
 * this file). Stored on globalThis so route-module duplication / HMR in
 * Next.js dev doesn't try to register the same metric name twice, which
 * prom-client throws on (same pattern as db.ts's Prisma middleware guard).
 */

interface PowMetrics {
    register: client.Registry
    apiCallDuration: client.Histogram<"service" | "status">
    apiCallErrors: client.Counter<"service" | "status_code">
    dbQueryDuration: client.Histogram<"model" | "action">
    syncCycleDuration: client.Histogram<"server_id">
    syncCycleNewLogs: client.Counter<"server_id">
    syncCycleFailures: client.Counter<"server_id">
    lastSyncTimestamp: client.Gauge<"server_id">
    sseConnections: client.Gauge
}

function build(): PowMetrics {
    const register = new client.Registry()
    client.collectDefaultMetrics({ register, prefix: "pow_dashboard_" })

    return {
        register,
        apiCallDuration: new client.Histogram({
            name: "pow_api_call_duration_seconds",
            help: "Duration of outbound API calls made by the dashboard",
            labelNames: ["service", "status"],
            buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
            registers: [register],
        }),
        apiCallErrors: new client.Counter({
            name: "pow_api_call_errors_total",
            help: "Count of failed/errored outbound API calls",
            labelNames: ["service", "status_code"],
            registers: [register],
        }),
        dbQueryDuration: new client.Histogram({
            name: "pow_db_query_duration_seconds",
            help: "Prisma query duration",
            labelNames: ["model", "action"],
            buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
            registers: [register],
        }),
        syncCycleDuration: new client.Histogram({
            name: "pow_sync_cycle_duration_seconds",
            help: "PRC log-sync cycle duration per server",
            labelNames: ["server_id"],
            buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 20],
            registers: [register],
        }),
        syncCycleNewLogs: new client.Counter({
            name: "pow_sync_cycle_new_logs_total",
            help: "New logs ingested per sync cycle",
            labelNames: ["server_id"],
            registers: [register],
        }),
        syncCycleFailures: new client.Counter({
            name: "pow_sync_cycle_failures_total",
            help: "Failed sync cycles per server",
            labelNames: ["server_id"],
            registers: [register],
        }),
        lastSyncTimestamp: new client.Gauge({
            name: "pow_last_sync_timestamp_seconds",
            help: "Unix timestamp of the last successful sync cycle per server",
            labelNames: ["server_id"],
            registers: [register],
        }),
        // healthState.sseConnections is already the source of truth (updated
        // in api/sse/[serverId]/route.ts) — read it live at scrape time
        // instead of duplicating the increment/decrement in two places.
        sseConnections: new client.Gauge({
            name: "pow_sse_connections",
            help: "Current number of open SSE connections",
            registers: [register],
            collect() {
                this.set(healthState.sseConnections)
            },
        }),
    }
}

const g = globalThis as unknown as { _powMetricsRegistry?: PowMetrics }
const metrics = g._powMetricsRegistry || (g._powMetricsRegistry = build())

export const {
    register,
    apiCallDuration,
    apiCallErrors,
    dbQueryDuration,
    syncCycleDuration,
    syncCycleNewLogs,
    syncCycleFailures,
    lastSyncTimestamp,
    sseConnections,
} = metrics
