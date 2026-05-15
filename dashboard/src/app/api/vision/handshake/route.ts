import { NextResponse } from "next/server"
import crypto from "crypto"
import { getVisionCorsHeaders } from "@/lib/vision-auth"
import { handshakeCodes } from "@/lib/handshake-store"

// Handle preflight requests
export async function OPTIONS(req: Request) {
    return NextResponse.json({}, { headers: getVisionCorsHeaders(req) })
}

// Generate a one-time handshake code for Vision auth
export async function POST(req: Request) {
    try {
        // No device auth here — this is the pre-auth bootstrap endpoint.
        // The code is short-lived (5 min), single-use, and grants no access
        // by itself. Device auth begins after the Clerk auth flow completes.

        // Cleanup expired codes (optional, could be a cron)
        await handshakeCodes.cleanup()

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
