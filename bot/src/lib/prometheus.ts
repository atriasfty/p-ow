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
