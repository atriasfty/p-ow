import { prisma } from "./db"
import { trackApiCall } from "./metrics"
import { outboundRateLimitHits } from "./prometheus"
import { isFeatureEnabled } from "./feature-flags"

// Rotector third-party safety-signal integration.
//
// Hard limits enforced here per rotector-integration-compliance.md — do not
// relax these without re-reading that document:
//   - Only the status-only batch endpoint is ever called. The full-info
//     endpoint, the Discord-connection endpoints, and the group
//     tracked-users endpoint are never called from this codebase.
//   - Only the bare flagType integer is stored. category/reasons/confidence/
//     evidence do not exist on this endpoint's response and must never be
//     added by widening the endpoint used here.
//   - flagType 8 (redacted) is never stored or displayed — any cached row is
//     deleted the moment it comes back, rather than shown or kept.
//   - Only flagType 2 (confirmed, human-reviewed) is ever treated as
//     "flagged" for display/UI purposes.
//   - No caller-identifying data is ever forwarded to Rotector. This module
//     only ever takes a bare list of Roblox IDs (see checkRotectorFlags'
//     signature below — it has no access to the inbound Request, so there is
//     nothing to leak: no moderator IP, no session, no headers, no cookies).
//     The only things sent upstream are { ids } and the API key.
//   - The cache is deliberately GLOBAL (keyed only by robloxId, not by
//     server): a Roblox account flagged for one community is flagged for all
//     of them, so there is no reason to re-poll Rotector per-server. Every
//     caller — the mod panel route and the /api/internal/rotector/status
//     endpoint used by the bot — shares this one cache and one outbound
//     rate-limit budget.
//   - The whole integration is gated behind the ROTECTOR_INTEGRATION feature
//     flag (superadmin-only, defaults OFF) because the DPIA covering this
//     integration has not been reviewed yet. checkRotectorFlags() below is
//     the single chokepoint every caller (both API routes, plus
//     warmRotectorCache) funnels through, so gating it there — rather than in
//     each caller — is what makes the flag authoritative. Do not add a path
//     that reaches Rotector or reads/writes RotectorFlag rows without going
//     through checkRotectorFlags().

const ROTECTOR_BASE_URL = "https://roscoe.rotector.com"
const ROTECTOR_STATUS_PATH = "/v1/lookup/roblox/user/status"
const API_BATCH_SIZE = 100

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h — matches Rotector's ToS storage cap

const ACTIONABLE_FLAG_TYPE = 2
const REDACTED_FLAG_TYPE = 8

// Rotector's link-out URL for a moderator to read the full assessment on
// Rotector's own site. POW never fetches or renders this content itself.
export function rotectorLookupUrl(robloxId: string): string {
    return `${ROTECTOR_BASE_URL}/v1/lookup/roblox/user/${encodeURIComponent(robloxId)}`
}

// --- Outbound rate limiting -------------------------------------------------
// Per https://roscoe.rotector.com/docs: Standard tier is 50 requests/10s per
// IP (50+/key with an API key), and "batch endpoints count as multiple
// requests towards your rate limit" — a single 100-id batch call can consume
// far more than 1 of those 50. Rather than guess the exact weighting, this
// trusts the server's own accounting via the X-RateLimit-Remaining/Reset
// response headers (same reactive pattern as PrcClient), and serializes every
// outbound call through one queue so concurrent moderator requests can't
// burst past whatever Rotector actually has remaining.

interface RateLimitState {
    remaining: number
    resetAt: number   // epoch ms when the current window resets
    blockedUntil: number // epoch ms, set from Retry-After on a 429
}

const globalForRotector = globalThis as unknown as {
    rotectorRateLimit: RateLimitState | undefined
    rotectorQueue: Promise<unknown> | undefined
}

const STANDARD_LIMIT = 50
const WINDOW_MS = 10000

// Conservative assumption before we've seen a real response — matches the
// documented Standard-tier floor.
const rateLimit = globalForRotector.rotectorRateLimit ??= {
    remaining: STANDARD_LIMIT,
    resetAt: Date.now() + WINDOW_MS,
    blockedUntil: 0
}

async function waitForSlot(): Promise<void> {
    if (rateLimit.blockedUntil > Date.now()) {
        await new Promise(r => setTimeout(r, rateLimit.blockedUntil - Date.now() + 100))
    }

    const now = Date.now()
    if (now > rateLimit.resetAt) {
        // Window rolled over with no fresh data from Rotector yet — reset to
        // the documented floor rather than assuming we still have headroom.
        rateLimit.remaining = STANDARD_LIMIT
        rateLimit.resetAt = now + WINDOW_MS
        return
    }

    if (rateLimit.remaining <= 0) {
        const wait = rateLimit.resetAt - now + 100
        await new Promise(r => setTimeout(r, Math.max(wait, 0)))
        rateLimit.remaining = STANDARD_LIMIT
        rateLimit.resetAt = Date.now() + WINDOW_MS
    }
}

// Trust Rotector's own accounting over any local guess about batch weighting.
function updateRateLimitFromHeaders(res: Response): void {
    const remaining = res.headers.get("X-RateLimit-Remaining")
    const reset = res.headers.get("X-RateLimit-Reset")
    if (remaining !== null) {
        const n = parseInt(remaining, 10)
        if (Number.isFinite(n)) rateLimit.remaining = n
    }
    if (reset !== null) {
        const n = parseInt(reset, 10)
        if (Number.isFinite(n)) rateLimit.resetAt = n * 1000
    }
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

// Serialized fetch of a single batch (<=100 ids) against the status-only endpoint.
async function fetchBatch(ids: string[]): Promise<Map<string, number>> {
    const currentQueue = globalForRotector.rotectorQueue || Promise.resolve()
    const thisRequest = currentQueue.then(() => doFetchBatch(ids))
    globalForRotector.rotectorQueue = thisRequest.catch(() => { })
    return thisRequest
}

async function doFetchBatch(ids: string[], retryCount = 0): Promise<Map<string, number>> {
    const MAX_RETRIES = 2
    await waitForSlot()

    const numericIds = ids.map(id => Number(id)).filter(n => Number.isInteger(n) && n > 0)
    if (numericIds.length === 0) return new Map()

    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (process.env.ROTECTOR_API_KEY) {
        headers["Authorization"] = `Bearer ${process.env.ROTECTOR_API_KEY}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    const startTime = Date.now()

    try {
        const res = await fetch(`${ROTECTOR_BASE_URL}${ROTECTOR_STATUS_PATH}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ ids: numericIds }),
            signal: controller.signal
        })

        const duration = Date.now() - startTime
        trackApiCall("rotector", "user/status", duration, res.ok ? "ok" : "error", undefined, undefined, res.status)
        updateRateLimitFromHeaders(res)

        if (res.status === 429) {
            outboundRateLimitHits.inc({ service: "rotector" })
            const retryAfter = parseInt(res.headers.get("Retry-After") || "10", 10)
            rateLimit.blockedUntil = Date.now() + (retryAfter * 1000)
            if (retryCount < MAX_RETRIES) {
                return doFetchBatch(ids, retryCount + 1)
            }
            console.warn("[ROTECTOR] Rate limited, giving up on this batch")
            return new Map()
        }

        if (!res.ok) {
            console.error(`[ROTECTOR] Batch status lookup failed: ${res.status}`)
            return new Map()
        }

        const json = await res.json()
        if (!json?.success || typeof json.data !== "object" || json.data === null) return new Map()

        const result = new Map<string, number>()
        for (const [id, flagType] of Object.entries(json.data as Record<string, unknown>)) {
            if (typeof flagType === "number") result.set(id, flagType)
        }
        return result
    } catch (err) {
        console.error("[ROTECTOR] Batch status lookup error:", err)
        return new Map()
    } finally {
        clearTimeout(timeoutId)
    }
}

// --- Cache-backed public API -------------------------------------------------

/**
 * Resolve which of the given Roblox IDs currently carry a confirmed
 * (flagType 2) Rotector flag. Uses a 24h cache; only re-polls Rotector for
 * ids that are missing or stale. Never returns or stores anything beyond the
 * bare flagType integer.
 */
export async function checkRotectorFlags(robloxIds: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>()

    // Feature-flagged off (default, until the DPIA is reviewed): no outbound
    // call, no cache read, nothing to display. Every caller funnels through
    // this function, so this is the one place that needs to enforce it.
    if (!(await isFeatureEnabled('ROTECTOR_INTEGRATION'))) return result

    const uniqueIds = [...new Set(robloxIds.filter(id => /^[0-9]+$/.test(id)))]
    if (uniqueIds.length === 0) return result

    const cached = await prisma.rotectorFlag.findMany({
        where: { robloxId: { in: uniqueIds } }
    })

    const now = Date.now()
    const cacheById = new Map(cached.map(c => [c.robloxId, c]))
    const staleOrMissing: string[] = []

    for (const id of uniqueIds) {
        const entry = cacheById.get(id)
        if (entry && (now - entry.retrievedAt.getTime()) < CACHE_TTL_MS) {
            result.set(id, entry.flagType === ACTIONABLE_FLAG_TYPE)
        } else {
            staleOrMissing.push(id)
        }
    }

    if (staleOrMissing.length === 0) return result

    const fetched = new Map<string, number>()
    for (const batch of chunk(staleOrMissing, API_BATCH_SIZE)) {
        const batchResult = await fetchBatch(batch)
        for (const [id, flagType] of batchResult) fetched.set(id, flagType)
    }

    const toUpsert: { robloxId: string, flagType: number }[] = []
    const toDelete: string[] = []

    for (const id of staleOrMissing) {
        const flagType = fetched.get(id)
        if (flagType === undefined) {
            // Rotector didn't return this id (unknown to them, or the call failed).
            // Leave any existing cache row alone rather than guessing.
            result.set(id, cacheById.get(id)?.flagType === ACTIONABLE_FLAG_TYPE)
            continue
        }

        if (flagType === REDACTED_FLAG_TYPE) {
            // Redacted is a purge instruction, not a display state — delete on sight.
            toDelete.push(id)
            result.set(id, false)
            continue
        }

        toUpsert.push({ robloxId: id, flagType })
        result.set(id, flagType === ACTIONABLE_FLAG_TYPE)
    }

    await prisma.$transaction([
        ...(toDelete.length > 0 ? [prisma.rotectorFlag.deleteMany({ where: { robloxId: { in: toDelete } } })] : []),
        ...toUpsert.map(({ robloxId, flagType }) =>
            prisma.rotectorFlag.upsert({
                where: { robloxId },
                create: { robloxId, flagType, retrievedAt: new Date() },
                update: { flagType, retrievedAt: new Date() }
            })
        )
    ])

    return result
}

/**
 * Pre-warm the cache for newly-seen Roblox IDs (e.g. players joining a
 * tracked server), so a moderator who looks a moment later sees fresh data
 * instead of triggering the Rotector call themselves. Fire-and-forget by
 * design — this does NOT log a view, since no moderator has been shown
 * anything yet.
 */
export async function warmRotectorCache(robloxIds: string[]): Promise<void> {
    try {
        await checkRotectorFlags(robloxIds)
    } catch (err) {
        console.error("[ROTECTOR] Cache warm failed:", err)
    }
}

/**
 * Log that a moderator was shown a Rotector flag for a given Roblox user.
 * Retained separately from the flag cache itself.
 */
export async function logRotectorFlagView(serverId: string, actorUserId: string, robloxId: string): Promise<void> {
    await prisma.rotectorFlagView.create({
        data: { serverId, actorUserId, robloxId }
    })
}
