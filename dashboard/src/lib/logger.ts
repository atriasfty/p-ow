/**
 * Minimal structured logger — zero dependencies.
 *
 * JSON lines in production (greppable/parseable from PM2 logs),
 * human-readable in development. Use child() to bind context like
 * serverId/userId once instead of repeating it per call.
 *
 * LOG_LEVEL env var: debug | info | warn | error (default info in prod, debug in dev)
 */

import { getCorrelationId } from "./request-context"

type Level = "debug" | "info" | "warn" | "error"
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

const isProd = process.env.NODE_ENV === "production"
const minLevel: number =
    LEVELS[(process.env.LOG_LEVEL as Level) || (isProd ? "info" : "debug")] ?? LEVELS.info

type Ctx = Record<string, unknown>

function serializeError(e: unknown) {
    if (e instanceof Error) return { name: e.name, message: e.message, stack: e.stack }
    return { message: String(e) }
}

function emit(level: Level, component: string, ctx: Ctx, msg: string, extra?: Ctx) {
    if (LEVELS[level] < minLevel) return
    const merged: Ctx = { ...ctx, ...extra }
    if (merged.err) merged.err = serializeError(merged.err)
    const correlationId = getCorrelationId()
    if (correlationId && !merged.correlationId) merged.correlationId = correlationId

    if (isProd) {
        // eslint-disable-next-line no-console
        console[level === "debug" ? "log" : level](
            JSON.stringify({ ts: new Date().toISOString(), level, component, msg, ...merged })
        )
    } else {
        const ctxStr = Object.keys(merged).length ? " " + JSON.stringify(merged) : ""
        // eslint-disable-next-line no-console
        console[level === "debug" ? "log" : level](`[${component}] ${level.toUpperCase()} ${msg}${ctxStr}`)
    }
}

export interface Logger {
    debug(msg: string, extra?: Ctx): void
    info(msg: string, extra?: Ctx): void
    warn(msg: string, extra?: Ctx): void
    error(msg: string, extra?: Ctx): void
    child(ctx: Ctx): Logger
}

export function createLogger(component: string, ctx: Ctx = {}): Logger {
    return {
        debug: (msg, extra) => emit("debug", component, ctx, msg, extra),
        info: (msg, extra) => emit("info", component, ctx, msg, extra),
        warn: (msg, extra) => emit("warn", component, ctx, msg, extra),
        error: (msg, extra) => emit("error", component, ctx, msg, extra),
        child: (childCtx) => createLogger(component, { ...ctx, ...childCtx }),
    }
}
