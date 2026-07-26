import { NextResponse } from "next/server"
import { checkSecurity } from "@/lib/security"
import { trackError } from "@/lib/errors"

/**
 * Best-effort sink for fatal client-side errors reported via navigator.sendBeacon
 * from global-error.tsx. It exists for the catastrophic case where the root
 * layout (and therefore PostHog) never initialised, so the client can't report
 * the exception itself. Rate-limited; payload is bounded and treated as opaque data.
 */
export async function POST(req: Request) {
    const secBlock = await checkSecurity(req)
    if (secBlock) return secBlock

    let message = "unknown"
    let digest: string | undefined
    try {
        const body = await req.json()
        if (typeof body?.message === "string") message = body.message.slice(0, 500)
        if (typeof body?.digest === "string") digest = body.digest.slice(0, 100)
    } catch {
        // malformed beacon body — ignore
    }

    trackError(new Error(`client fatal: ${message}`), { source: "global-error:beacon", digest })
    return NextResponse.json({ ok: true })
}
