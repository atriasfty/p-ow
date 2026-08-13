/**
 * Discord webhook alerting for operational events.
 *
 * Fire-and-forget: never throws, never blocks the caller.
 * Per-key cooldown prevents an incident from flooding the channel —
 * repeat alerts within the cooldown are counted and reported on the
 * next allowed send as "(suppressed N repeats)".
 */

const WEBHOOK_URL = process.env.ALERT_DISCORD_WEBHOOK_URL
// Separate channel for infra-level alerts (host mem/disk, PM2 process down,
// container down) forwarded from Alertmanager via api/internal/infra-alert —
// kept apart from app-level alerts on purpose. Blank/unset = silently
// disabled, same as the app webhook, rather than falling back to it.
const INFRA_WEBHOOK_URL = process.env.INFRA_ALERT_DISCORD_WEBHOOK_URL

export type AlertSeverity = "info" | "warning" | "critical"

const SEVERITY_COLOR: Record<AlertSeverity, number> = {
    info: 0x3b82f6,     // blue
    warning: 0xf59e0b,  // amber
    critical: 0xef4444, // red
}

const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000

// Survives HMR / route-module duplication in the Next.js server process
const g = globalThis as unknown as {
    _powAlertState?: Map<string, { lastSentAt: number; suppressed: number }>
}
const alertState = g._powAlertState || (g._powAlertState = new Map())

function envLabel(): string {
    return process.env.APP_ENV || process.env.NODE_ENV || "unknown"
}

export function sendAlert(opts: {
    /** Dedup key — alerts sharing a key are rate-limited together (e.g. `sync-fail:${serverId}`) */
    key: string
    title: string
    message: string
    severity?: AlertSeverity
    /** Extra fields rendered in the embed */
    fields?: Record<string, string | number | null | undefined>
    /** Override the per-key cooldown (ms). Pass 0 to always send. */
    cooldownMs?: number
    /** Which Discord webhook to send to. Default "app". */
    channel?: "app" | "infra"
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

        const body = {
            embeds: [
                {
                    title: `${severity === "critical" ? "🔴" : severity === "warning" ? "🟡" : "🔵"} ${opts.title}`.slice(0, 256),
                    description:
                        opts.message.slice(0, 3900) +
                        (suppressed > 0 ? `\n\n_(suppressed ${suppressed} repeat${suppressed === 1 ? "" : "s"} in the last cooldown window)_` : ""),
                    color: SEVERITY_COLOR[severity],
                    fields,
                    footer: { text: `pow-dashboard · ${envLabel()}` },
                    timestamp: new Date().toISOString(),
                },
            ],
        }

        const targetUrl = opts.channel === "infra" ? INFRA_WEBHOOK_URL : WEBHOOK_URL
        if (!targetUrl) return // no webhook configured — nothing to send

        // Fire and forget — an alerting failure must never affect the app
        fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        }).catch(() => { })
    } catch {
        // never throw from alerting
    }
}
