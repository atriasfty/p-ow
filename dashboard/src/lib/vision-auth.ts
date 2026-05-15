import crypto from "crypto"
import { prisma } from "@/lib/db"

/**
 * Verifies a per-device HMAC signature from Vision app requests.
 *
 * Header format — X-Vision-Sig: deviceId:timestamp:signature
 * Signature = HMAC-SHA256(timestamp:deviceId, deviceSecret)
 *
 * The deviceSecret lives in the DB (registered on first launch) and in the
 * user's OS keychain via Electron safeStorage — never in the binary.
 */
export async function verifyVisionDevice(
    sigHeader: string | null,
    expectedUserId: string
): Promise<boolean> {
    if (!sigHeader) return false

    const parts = sigHeader.split(":")
    if (parts.length !== 3) return false

    const [deviceId, timestamp, signature] = parts
    const ts = parseInt(timestamp, 10)

    if (isNaN(ts) || Math.abs(Date.now() - ts) > 300_000) return false

    const device = await prisma.visionDevice.findUnique({ where: { id: deviceId } })
    if (!device || device.revokedAt || device.userId !== expectedUserId) return false

    const expected = crypto
        .createHmac("sha256", device.deviceSecret)
        .update(`${timestamp}:${deviceId}`)
        .digest("hex")

    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length) return false
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false

    // Fire-and-forget lastUsedAt update
    prisma.visionDevice.update({
        where: { id: deviceId },
        data: { lastUsedAt: new Date() }
    }).catch(() => {})

    return true
}

export function getVisionCorsHeaders(req: Request) {
    const origin = req.headers.get("origin") || ""

    const allowedOrigins = [
        "null", // Electron file:// protocol
        "http://localhost:3000",
        "http://localhost:5173",
        process.env.NEXT_PUBLIC_APP_URL
    ].filter(Boolean) as string[]

    const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0]

    return {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Vision-Sig"
    }
}
