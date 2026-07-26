import PostHogClient from "./posthog"
import { sendAlert, type AlertSeverity } from "./alerting"

/**
 * Server-side error tracking routed to PostHog error tracking ($exception).
 *
 * Quota-conscious: identical errors (same name + message + source) are
 * deduplicated — at most one $exception event per key per DEDUP_WINDOW_MS,
 * with a `repeat_count` property carrying how many were suppressed.
 */

const DEDUP_WINDOW_MS = 5 * 60 * 1000
const SYSTEM_ACTOR = "pow-system"
const MAX_ERROR_KEYS = 500

/**
 * Collapse per-occurrence variable data (IDs, counts, timestamps, hex/UUID/cuid
 * tokens) out of an error message so that a hot-looping error whose message
 * embeds a changing ID still shares one dedup/cooldown key instead of bypassing
 * both the PostHog dedup window and the Discord alert cooldown.
 */
function normalizeMessage(msg: string): string {
    return msg
        .replace(/0x[0-9a-fA-F]+/g, "#") // hex addresses
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "#") // uuid
        .replace(/c[a-z0-9]{24}/g, "#") // cuid
        .replace(/\d+/g, "#") // any remaining numbers
        .slice(0, 200)
}

const g = globalThis as unknown as {
    _powErrorState?: Map<string, { lastSentAt: number; suppressed: number }>
}
const errorState = g._powErrorState || (g._powErrorState = new Map())

export function trackError(
    error: unknown,
    context: {
        /** Where the error happened, e.g. "api:/api/internal/sync", "sse", "unhandledRejection" */
        source: string
        serverId?: string
        userId?: string
        [key: string]: string | number | boolean | null | undefined
    },
    opts?: {
        /** Also send a Discord alert (default: false) */
        alert?: boolean
        alertSeverity?: AlertSeverity
    }
): void {
    try {
        const err = error instanceof Error ? error : new Error(String(error))
        const key = `${context.source}:${err.name}:${normalizeMessage(err.message)}`
        const now = Date.now()
        const state = errorState.get(key)

        // Cap map growth from unbounded distinct error keys. Evict the oldest
        // entry rather than clearing the whole map, so in-window cooldowns for
        // unrelated active errors aren't reset (which would allow double-alerts).
        if (!state && errorState.size >= MAX_ERROR_KEYS) {
            const oldest = errorState.keys().next().value
            if (oldest !== undefined) errorState.delete(oldest)
        }

        if (state && now - state.lastSentAt < DEDUP_WINDOW_MS) {
            state.suppressed++
            return
        }
        const suppressed = state?.suppressed || 0
        errorState.set(key, { lastSentAt: now, suppressed: 0 })

        console.error(`[ERROR] ${context.source}:`, err)

        const posthog = PostHogClient()
        posthog.captureException(err, context.userId || SYSTEM_ACTOR, {
            ...context,
            server_id: context.serverId || null,
            repeat_count: suppressed,
            environment: process.env.APP_ENV || process.env.NODE_ENV || "unknown",
        })

        if (opts?.alert) {
            sendAlert({
                key: `error:${key}`,
                title: `Error in ${context.source}`,
                message: `\`\`\`${(err.stack || err.message).slice(0, 1500)}\`\`\``,
                severity: opts.alertSeverity || "critical",
                fields: {
                    serverId: context.serverId,
                    repeats: suppressed > 0 ? suppressed : undefined,
                },
            })
        }
    } catch {
        // error tracking must never crash the app
    }
}
