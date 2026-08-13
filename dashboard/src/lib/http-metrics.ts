import { httpRequestDuration } from "./prometheus"

/**
 * Wraps a Next.js App Router route handler to record
 * pow_http_request_duration_seconds{route,method,status}. `route` is a
 * fixed label passed in by the caller (never derived from the URL) so
 * dynamic segments (server IDs, etc.) can't blow up cardinality.
 *
 * Applied to the highest-value routes (public/v1 paid API, internal sync,
 * admin/projector-stats, maintenance-check) rather than every route.ts in
 * the app — extend coverage by wrapping additional routes the same way.
 */
export function withHttpMetrics<Args extends unknown[]>(
    route: string,
    handler: (req: Request, ...args: Args) => Promise<Response>
): (req: Request, ...args: Args) => Promise<Response> {
    return async (req: Request, ...args: Args) => {
        const start = Date.now()
        let status = 500
        try {
            const res = await handler(req, ...args)
            status = res.status
            return res
        } finally {
            httpRequestDuration.observe(
                { route, method: req.method, status: String(status) },
                (Date.now() - start) / 1000
            )
        }
    }
}
