import client from "prom-client"

/**
 * Prometheus metrics registry for the bot process. Scraped by the
 * observability stack's Prometheus over /metrics on BOT_HEALTH_PORT (see
 * the http server in index.ts). The bot is a single long-running process
 * (no HMR/module duplication concern like the Next.js dashboard has), so no
 * globalThis guard is needed here.
 */

export const register = new client.Registry()
client.collectDefaultMetrics({ register, prefix: "pow_bot_" })

export const gatewayStatus = new client.Gauge({
    name: "pow_bot_gateway_status",
    help: "Discord gateway WebSocket status (client.ws.status — 0 = READY)",
    registers: [register],
})

export const queuePending = new client.Gauge({
    name: "pow_bot_queue_pending",
    help: "Pending items in the outbound Discord message/DM queue",
    registers: [register],
})

export const queueOldestAgeSeconds = new client.Gauge({
    name: "pow_bot_queue_oldest_age_seconds",
    help: "Age in seconds of the oldest pending queue item",
    registers: [register],
})

export const alertSendFailures = new client.Counter({
    name: "pow_bot_alert_send_failures_total",
    help: "Discord webhook alert deliveries that failed (fetch threw or returned non-2xx)",
    registers: [register],
})

export const commandDuration = new client.Histogram({
    name: "pow_bot_command_duration_seconds",
    help: "Slash command handler duration by command name",
    labelNames: ["command"],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20],
    registers: [register],
})

export const commandErrors = new client.Counter({
    name: "pow_bot_command_errors_total",
    help: "Slash command handler errors by command name",
    labelNames: ["command"],
    registers: [register],
})
