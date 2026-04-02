import { NextResponse } from "next/server"
import crypto from "crypto"
import { verifyVisionSignature, getVisionCorsHeaders } from "@/lib/vision-auth"
import { handshakeCodes } from "@/lib/handshake-store"

// Handle preflight requests
export async function OPTIONS(req: Request) {
    return NextResponse.json({}, { headers: getVisionCorsHeaders(req.headers.get("origin")) })
}

// Generate a one-time handshake code for Vision auth
export async function POST(req: Request) {
    try {
        // Verify the request is from Vision app using HMAC signature
        const signature = req.headers.get("X-Vision-Sig")
        if (!verifyVisionSignature(signature)) {
            console.log("[Vision Handshake] Invalid signature:", signature?.substring(0, 50))
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 403, headers: getVisionCorsHeaders(req.headers.get("origin")) }
            )
        }

        // Cleanup expired codes (optional, could be a cron)
        await handshakeCodes.cleanup()

        // Generate a random code
        const code = crypto.randomBytes(32).toString('hex')

        // Store with 5 minute expiry
        await handshakeCodes.set(code, {
            expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
        })

        return NextResponse.json({ code }, { headers: getVisionCorsHeaders(req.headers.get("origin")) })
    } catch (error) {
        console.error("[Vision Handshake] Error:", error)
        return NextResponse.json({ error: "Failed to create handshake" }, { status: 500, headers: getVisionCorsHeaders(req.headers.get("origin")) })
    }
}

// Validate a handshake code (DO NOT consume here, consumption happens on login page)
export async function GET(req: Request) {
    try {
        const url = new URL(req.url)
        const code = url.searchParams.get("code")

        if (!code) {
            return NextResponse.json({ valid: false }, { headers: getVisionCorsHeaders(req.headers.get("origin")) })
        }

        const handshake = await handshakeCodes.get(code)

        if (!handshake) {
            return NextResponse.json({ valid: false }, { headers: getVisionCorsHeaders(req.headers.get("origin")) })
        }

        if (Date.now() > handshake.expiresAt) {
            await handshakeCodes.delete(code)
            return NextResponse.json({ valid: false, error: "expired" }, { headers: getVisionCorsHeaders(req.headers.get("origin")) })
        }

        // We do NOT consume the code here anymore to prevent DoS attacks 
        // that could invalidate a legitimate user's session before they can use it.
        // The code is consumed in vision-auth/page.tsx.

        return NextResponse.json({ valid: true }, { headers: getVisionCorsHeaders(req.headers.get("origin")) })
    } catch (error) {
        console.error("[Vision Handshake] Validate error:", error)
        return NextResponse.json({ valid: false }, { status: 500, headers: getVisionCorsHeaders(req.headers.get("origin")) })
    }
}

export { handshakeCodes }
