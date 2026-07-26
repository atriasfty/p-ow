import { trackError } from "./errors"

/**
 * Process-level crash reporting. Only ever imported from instrumentation.ts
 * under the nodejs runtime — kept separate so the edge bundle never sees
 * process.on.
 */

const g = globalThis as unknown as { _powProcessHandlers?: boolean }

export function registerProcessHandlers() {
    if (g._powProcessHandlers) return
    g._powProcessHandlers = true

    process.on("unhandledRejection", (reason) => {
        trackError(reason, { source: "unhandledRejection" }, { alert: true })
    })

    process.on("uncaughtException", (err) => {
        trackError(err, { source: "uncaughtException" }, { alert: true })
        // Node's contract: once an uncaughtException listener is attached the
        // process will NOT exit on its own. The process is now in an undefined
        // state, so log/alert then exit and let PM2 restart us (mirrors bot).
        setTimeout(() => process.exit(1), 1500)
    })
}
