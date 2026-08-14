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
    httpRequestDuration: client.Histogram<"route" | "method" | "status">
    prcKeyInvalidServers: client.Gauge
    automationExecutions: client.Counter<"type" | "outcome">
    automationDuration: client.Histogram<"type">
    outboundRateLimitHits: client.Counter<"service">
    dataCleanupDuration: client.Histogram<"server_id">
    dataCleanupRowsDeleted: client.Counter<"model">
    webhookDeliveryDuration: client.Histogram<"outcome">
    webhookDeliveryFailures: client.Counter
    auditEvents: client.Counter<"event" | "origin">
    alertSendFailures: client.Counter<"channel">
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
        httpRequestDuration: new client.Histogram({
            name: "pow_http_request_duration_seconds",
            help: "Inbound HTTP request duration for routes wrapped with withHttpMetrics (see http-metrics.ts) — not yet applied to every route in the app",
            labelNames: ["route", "method", "status"],
            buckets: [0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
            registers: [register],
        }),
        // Dynamic import inside collect() to avoid a static circular import
        // (db.ts -> metrics.ts -> prometheus.ts) — same pattern used for
        // AutomationEngine in api/internal/sync/route.ts.
        prcKeyInvalidServers: new client.Gauge({
            name: "pow_prc_key_invalid_servers",
            help: "Count of servers currently flagged with an invalid PRC Server-Key (sync stopped for them)",
            registers: [register],
            async collect() {
                const { prisma } = await import("./db")
                this.set(await prisma.server.count({ where: { prcKeyInvalid: true } }))
            },
        }),
        automationExecutions: new client.Counter({
            name: "pow_automation_executions_total",
            help: "Automation engine trigger executions",
            labelNames: ["type", "outcome"],
            registers: [register],
        }),
        automationDuration: new client.Histogram({
            name: "pow_automation_duration_seconds",
            help: "Automation engine execution duration per trigger type",
            labelNames: ["type"],
            buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
            registers: [register],
        }),
        alertSendFailures: new client.Counter({
            name: "pow_alert_send_failures_total",
            help: "Discord webhook alert deliveries that failed (fetch threw or returned non-2xx) — a nonzero rate here means alerting itself may be blind",
            labelNames: ["channel"],
            registers: [register],
        }),
        outboundRateLimitHits: new client.Counter({
            name: "pow_outbound_ratelimit_hits_total",
            help: "429 responses from outbound API calls (PRC, Rotector) — both already back off/retry internally on this, but that was previously invisible",
            labelNames: ["service"],
            registers: [register],
        }),
        dataCleanupDuration: new client.Histogram({
            name: "pow_data_cleanup_duration_seconds",
            help: "Per-server data retention cleanup run duration (data-cleanup.ts)",
            labelNames: ["server_id"],
            buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
            registers: [register],
        }),
        dataCleanupRowsDeleted: new client.Counter({
            name: "pow_data_cleanup_rows_deleted_total",
            help: "Rows deleted per model by the retention cleanup job",
            labelNames: ["model"],
            registers: [register],
        }),
        webhookDeliveryDuration: new client.Histogram({
            name: "pow_webhook_delivery_duration_seconds",
            help: "Outbound automation webhook (user-configured URL) delivery duration",
            labelNames: ["outcome"],
            buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
            registers: [register],
        }),
        webhookDeliveryFailures: new client.Counter({
            name: "pow_webhook_delivery_failures_total",
            help: "Outbound automation webhook deliveries that failed",
            registers: [register],
        }),
        auditEvents: new client.Counter({
            name: "pow_audit_events_total",
            help: "Audit log entries written (audit.ts logAudit calls)",
            labelNames: ["event", "origin"],
            registers: [register],
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
    httpRequestDuration,
    prcKeyInvalidServers,
    automationExecutions,
    automationDuration,
    alertSendFailures,
    outboundRateLimitHits,
    dataCleanupDuration,
    dataCleanupRowsDeleted,
    webhookDeliveryDuration,
    webhookDeliveryFailures,
    auditEvents,
} = metrics
