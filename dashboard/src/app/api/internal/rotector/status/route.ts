import { checkRotectorFlags } from "@/lib/rotector"
import { NextResponse } from "next/server"
import crypto from "crypto"

const INTERNAL_SECRET = process.env.INTERNAL_SYNC_SECRET!
const MAX_IDS_PER_REQUEST = 200

// Inbound abuse guard for this endpoint itself — separate from the outbound
// Rotector rate limit in rotector.ts. Holding the shared secret doesn't mean
// unlimited calls: this caps a runaway loop, a bug, or a leaked secret from
// hammering the endpoint (and, downstream, our own DB and Rotector's API).
// Generous enough for legitimate concurrent use across every community this
// process serves, since checkRotectorFlags is itself cache-backed.
const globalForInternalRotector = globalThis as unknown as {
    internalRotectorRateLimit: { windowStart: number, count: number } | undefined
}
const inboundRateLimit = globalForInternalRotector.internalRotectorRateLimit ??= { windowStart: Date.now(), count: 0 }
const INBOUND_WINDOW_MS = 10000
const INBOUND_MAX_PER_WINDOW = 120

function checkInboundRateLimit(): boolean {
    const now = Date.now()
    if (now - inboundRateLimit.windowStart > INBOUND_WINDOW_MS) {
        inboundRateLimit.windowStart = now
        inboundRateLimit.count = 0
    }
    inboundRateLimit.count++
    return inboundRateLimit.count <= INBOUND_MAX_PER_WINDOW
}

/**
 * POST /api/internal/rotector/status
 *
 * The only network-callable entry point that ever talks to Rotector. Backed
 * by the global 24h cache in rotector.ts (keyed by robloxId only, not
 * per-server), so every caller — the dashboard's own mod-panel route, the
 * bot, or anything added later — shares one cache and one outbound
 * rate-limit budget instead of each maintaining its own and risking
 * duplicate/overlapping calls to Rotector's per-IP limit.
 *
 * Body: { robloxIds: string[] }
 * Response: { [robloxId]: boolean } — true only for a confirmed (flagType 2)
 * flag. Never returns category/reasons/confidence/evidence.
 *
 * Nothing about the caller (IP, headers, session, cookies) is ever forwarded
 * to Rotector — the outbound request to Rotector contains only { ids } and
 * the API key, see rotector.ts.
 *
 * Auth: x-internal-secret header (same shared secret as /api/internal/sync).
 * Also rate-limited (120 req/10s, process-wide) independent of Rotector's own
 * limit, so a leaked secret or a runaway caller can't flood this endpoint.
 */
export async function POST(req: Request) {
    const authHeader = req.headers.get("x-internal-secret")

    if (
        !INTERNAL_SECRET ||
        !authHeader ||
        authHeader.length !== INTERNAL_SECRET.length ||
        !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(INTERNAL_SECRET))
    ) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!checkInboundRateLimit()) {
        return new NextResponse("Too many requests", { status: 429 })
    }

    let body: { robloxIds?: string[] }
    try {
        body = await req.json()
    } catch {
        return new NextResponse("Invalid JSON body", { status: 400 })
    }

    const { robloxIds } = body
    if (!Array.isArray(robloxIds) || robloxIds.length === 0) {
        return new NextResponse("Missing robloxIds", { status: 400 })
    }
    if (robloxIds.length > MAX_IDS_PER_REQUEST) {
        return new NextResponse(`Too many robloxIds (max ${MAX_IDS_PER_REQUEST})`, { status: 400 })
    }

    try {
        const flagged = await checkRotectorFlags(robloxIds)
        return NextResponse.json(Object.fromEntries(flagged))
    } catch (err) {
        console.error("[ROTECTOR] Internal status route error:", err)
        return new NextResponse("Internal error", { status: 500 })
    }
}
