import { NextResponse } from "next/server"
import crypto from "crypto"
import { getVisionCorsHeaders } from "@/lib/vision-auth"
import { handshakeCodes } from "@/lib/handshake-store"
import { checkSecurity } from "@/lib/security"
import { prisma } from "@/lib/db"

// Handle preflight requests
export async function OPTIONS(req: Request) {
    return NextResponse.json({}, { headers: getVisionCorsHeaders(req) })
}

// Per-IP soft cap on simultaneous outstanding handshake codes. The global
// rate-limit (checkSecurity) bounds the call frequency; this bounds the
// number of rows a single source can keep alive in the table.
const PENDING_PER_IP_LIMIT = 20
const ipPending = new Map<string, number[]>()

function getClientIp(req: Request): string {
    const cfIp = req.headers.get("cf-connecting-ip")
    if (cfIp) return cfIp
    const forwarded = req.headers.get("x-forwarded-for")
    if (forwarded) return forwarded.split(",").at(-1)?.trim() ?? "unknown"
    const realIp = req.headers.get("x-real-ip")
    if (realIp) return realIp
    return "unknown"
}

// Generate a one-time handshake code for Vision auth
export async function POST(req: Request) {
    try {
        // Pre-auth endpoint — anyone can call. Apply the standard rate limit
        // so a single source can't flood the VisionHandshake table.
        const securityBlock = await checkSecurity(req)
        if (securityBlock) return securityBlock

        const ip = getClientIp(req)
        if (ip !== "unknown") {
            const now = Date.now()
            const windowStart = now - 5 * 60 * 1000
            const recent = (ipPending.get(ip) || []).filter(t => t > windowStart)
            if (recent.length >= PENDING_PER_IP_LIMIT) {
                return NextResponse.json(
                    { error: "Too many pending handshakes" },
                    { status: 429, headers: getVisionCorsHeaders(req) }
                )
            }
            recent.push(now)
            ipPending.set(ip, recent)
        }

        // Cleanup expired codes opportunistically. Cheap upper-bound on
        // table size from a determined attacker even at the rate-limit cap.
        await handshakeCodes.cleanup()
        await prisma.visionHandshake.deleteMany({
            where: { expiresAt: { lt: new Date() } }
        }).catch(() => {})

        // Generate a random code
        const code = crypto.randomBytes(32).toString('hex')

        // Store with 5 minute expiry
        await handshakeCodes.set(code, {
            expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
        })

        return NextResponse.json({ code }, { headers: getVisionCorsHeaders(req) })
    } catch (error) {
        console.error("[Vision Handshake] Error:", error)
        return NextResponse.json({ error: "Failed to create handshake" }, { status: 500, headers: getVisionCorsHeaders(req) })
    }
}

// Validate a handshake code (DO NOT consume here, consumption happens on login page)
export async function GET(req: Request) {
    try {
        const url = new URL(req.url)
        const code = url.searchParams.get("code")

        if (!code) {
            return NextResponse.json({ valid: false }, { headers: getVisionCorsHeaders(req) })
        }

        const handshake = await handshakeCodes.get(code)

        if (!handshake) {
            return NextResponse.json({ valid: false }, { headers: getVisionCorsHeaders(req) })
        }

        if (Date.now() > handshake.expiresAt) {
            return NextResponse.json({ valid: false, error: "expired" }, { headers: getVisionCorsHeaders(req) })
        }

        // We do NOT consume the code here anymore to prevent DoS attacks 
        // that could invalidate a legitimate user's session before they can use it.
        // The code is consumed in vision-auth/page.tsx.

        return NextResponse.json({ valid: true }, { headers: getVisionCorsHeaders(req) })
    } catch (error) {
        console.error("[Vision Handshake] Validate error:", error)
        return NextResponse.json({ valid: false }, { status: 500, headers: getVisionCorsHeaders(req) })
    }
}

export { handshakeCodes }
