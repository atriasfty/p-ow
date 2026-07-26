import type { Instrumentation } from "next"

/**
 * Next.js instrumentation — process-level crash reporting and
 * server-side request error capture. Runs once per server process.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return

    const { registerProcessHandlers } = await import("./lib/process-monitoring")
    registerProcessHandlers()
}

/**
 * Called by Next.js for every error thrown while handling a request
 * (API routes, server components, middleware). Covers all ~90 API routes
 * without wrapping each one.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
    if (process.env.NEXT_RUNTIME !== "nodejs") return
    const { trackError } = await import("./lib/errors")
    trackError(err, {
        source: `request:${request.path}`,
        method: request.method,
        routerKind: context.routerKind,
        routeType: context.routeType,
    })
}
