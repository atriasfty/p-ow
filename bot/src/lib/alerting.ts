/**
 * Discord webhook alerting for operational events (bot process).
 *
 * Uses a plain webhook HTTP call — independent of the Discord gateway, so
 * alerts still deliver when the bot's gateway connection is down.
 * Fire-and-forget: never throws, never blocks. Per-key cooldown prevents
 * an incident from flooding the channel.
 */

import { alertSendFailures } from "./prometheus"

const WEBHOOK_URL = process.env.ALERT_DISCORD_WEBHOOK_URL

export type AlertSeverity = "info" | "warning" | "critical"

const SEVERITY_COLOR: Record<AlertSeverity, number> = {
    info: 0x3b82f6,
    warning: 0xf59e0b,
    critical: 0xef4444,
}

const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000

const alertState = new Map<string, { lastSentAt: number; suppressed: number }>()

export function sendAlert(opts: {
    key: string
    title: string
    message: string
    severity?: AlertSeverity
    fields?: Record<string, string | number | null | undefined>
    cooldownMs?: number
}): void {
    try {
        const severity = opts.severity || "warning"
        const cooldown = opts.cooldownMs ?? DEFAULT_COOLDOWN_MS
        const now = Date.now()
        const state = alertState.get(opts.key)

        if (state && cooldown > 0 && now - state.lastSentAt < cooldown) {
            state.suppressed++
            return
        }

        const suppressed = state?.suppressed || 0
        alertState.set(opts.key, { lastSentAt: now, suppressed: 0 })

        const fields = Object.entries(opts.fields || {})
            .filter(([, v]) => v !== null && v !== undefined && v !== "")
            .slice(0, 10)
            .map(([name, value]) => ({
                name,
                value: String(value).slice(0, 1024),
                inline: true,
            }))

        // Only critical alerts page @everyone — warning/info sit in the
        // channel unread-but-visible instead of interrupting everyone.
        const body = {
            content: severity === "critical" ? "@everyone" : undefined,
            allowed_mentions: { parse: severity === "critical" ? ["everyone" as const] : [] },
            embeds: [
                {
                    title: `${severity === "critical" ? "🔴" : severity === "warning" ? "🟡" : "🔵"} ${opts.title}`.slice(0, 256),
                    description:
                        opts.message.slice(0, 3900) +
                        (suppressed > 0 ? `\n\n_(suppressed ${suppressed} repeat${suppressed === 1 ? "" : "s"} in the last cooldown window)_` : ""),
                    color: SEVERITY_COLOR[severity],
                    fields,
                    footer: { text: `pow-bot · ${process.env.APP_ENV || process.env.NODE_ENV || "unknown"}` },
                    timestamp: new Date().toISOString(),
                },
            ],
        }

        if (!WEBHOOK_URL) return // no webhook configured — nothing to send

        fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
            .then(res => {
                if (!res.ok) alertSendFailures.inc()
            })
            .catch(() => alertSendFailures.inc())
    } catch {
        // never throw from alerting
    }
}
