import { getSession } from "@/lib/auth-clerk"
import { isServerMember } from "@/lib/admin"
import { checkSecurity } from "@/lib/security"
import { logRotectorFlagView } from "@/lib/rotector"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { NextResponse } from "next/server"

// Batch Rotector flag lookup for the mod panel. Returns only a boolean per
// Roblox ID (true = confirmed flag, flagType 2). Never returns category,
// reasons, confidence, or evidence — see rotector-integration-compliance.md.
//
// This route never calls Rotector itself — it delegates to
// /api/internal/rotector/status, the single chokepoint that talks to
// Rotector and owns the shared 24h cache. That way the bot (or anything
// else) can reuse the exact same cache and rate-limit budget instead of
// duplicating Rotector-calling code.
const MAX_IDS_PER_REQUEST = 200
const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000"
const INTERNAL_SECRET = process.env.INTERNAL_SYNC_SECRET!

export async function POST(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const securityBlock = await checkSecurity(req)
    if (securityBlock) return securityBlock

    let body: { serverId?: string, robloxIds?: string[] }
    try {
        body = await req.json()
    } catch {
        return new NextResponse("Invalid JSON body", { status: 400 })
    }

    const { serverId, robloxIds } = body
    if (!serverId) return new NextResponse("Missing serverId", { status: 400 })
    if (!Array.isArray(robloxIds) || robloxIds.length === 0) {
        return new NextResponse("Missing robloxIds", { status: 400 })
    }
    if (robloxIds.length > MAX_IDS_PER_REQUEST) {
        return new NextResponse(`Too many robloxIds (max ${MAX_IDS_PER_REQUEST})`, { status: 400 })
    }

    // Tenant isolation: any member of this server may see flags (no stricter
    // role gate is applied here per product decision).
    if (!(await isServerMember(session.user as any, serverId))) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    // Rotector is behind a superadmin feature flag, defaulted off until its
    // DPIA is reviewed. checkRotectorFlags() also enforces this, but bail out
    // here too so a disabled integration doesn't even make the internal hop.
    if (!(await isFeatureEnabled('ROTECTOR_INTEGRATION'))) {
        return NextResponse.json({})
    }

    try {
        const internalRes = await fetch(`${DASHBOARD_URL}/api/internal/rotector/status`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal-secret": INTERNAL_SECRET
            },
            body: JSON.stringify({ robloxIds })
        })

        if (!internalRes.ok) {
            console.error(`[ROTECTOR] Internal status call failed: ${internalRes.status}`)
            return new NextResponse("Internal error", { status: 502 })
        }

        const flaggedMap: Record<string, boolean> = await internalRes.json()

        const flaggedIds = Object.entries(flaggedMap).filter(([, isFlagged]) => isFlagged).map(([id]) => id)
        if (flaggedIds.length > 0) {
            await Promise.all(
                flaggedIds.map(robloxId => logRotectorFlagView(serverId, session.user.id, robloxId))
            )
        }

        return NextResponse.json(flaggedMap)
    } catch (err) {
        console.error("[ROTECTOR] Status route error:", err)
        return new NextResponse("Internal error", { status: 500 })
    }
}
