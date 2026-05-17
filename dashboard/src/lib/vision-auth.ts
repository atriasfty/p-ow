import crypto from "crypto"
import { prisma } from "@/lib/db"

/**
 * Verifies a per-device HMAC signature from Vision app requests.
 *
 * Header format — X-Vision-Sig: deviceId:timestamp:nonce:signature
 * Signature = HMAC-SHA256(
 *     `${timestamp}:${deviceId}:${nonce}:${method}:${path}:${bodyHash}`,
 *     deviceSecret
 * )
 *   - bodyHash = sha256(rawBody) hex, or "" for empty bodies (e.g. GET)
 *   - nonce = 32 hex chars; tracked server-side to prevent replay within the window
 *   - timestamp = ms since epoch, must be within REPLAY_WINDOW_MS of now
 *
 * The deviceSecret lives in the DB (registered on first launch) and in the
 * user's OS keychain via Electron safeStorage — never in the binary.
 */

const REPLAY_WINDOW_MS = 60_000

// nonce -> expiresAt epoch ms. Single-process; if scaled out we'd move to redis.
const seenNonces = new Map<string, number>()

function pruneNonces() {
    if (seenNonces.size < 1000) return
    const now = Date.now()
    for (const [n, exp] of seenNonces) if (exp < now) seenNonces.delete(n)
}

export async function verifyVisionDevice(
    sigHeader: string | null,
    expectedUserId: string,
    req: Request,
    rawBody: string = ""
): Promise<boolean> {
    if (!sigHeader) return false

    const parts = sigHeader.split(":")
    if (parts.length !== 4) return false

    const [deviceId, timestamp, nonce, signature] = parts
    const ts = parseInt(timestamp, 10)

    if (isNaN(ts) || Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) return false
    if (!/^[a-f0-9]{32}$/i.test(nonce)) return false

    pruneNonces()
    if (seenNonces.has(nonce)) return false

    const device = await prisma.visionDevice.findUnique({ where: { id: deviceId } })
    if (!device || device.revokedAt || device.userId !== expectedUserId) return false

    const url = new URL(req.url)
    const method = req.method.toUpperCase()
    const bodyHash = rawBody ? crypto.createHash("sha256").update(rawBody).digest("hex") : ""
    const payload = `${timestamp}:${deviceId}:${nonce}:${method}:${url.pathname}:${bodyHash}`

    const expected = crypto
        .createHmac("sha256", device.deviceSecret)
        .update(payload)
        .digest("hex")

    const sigBuf = Buffer.from(signature, "hex")
    const expBuf = Buffer.from(expected, "hex")
    if (sigBuf.length !== expBuf.length || sigBuf.length === 0) return false
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false

    // Record nonce so it cannot be reused within the window
    seenNonces.set(nonce, Date.now() + REPLAY_WINDOW_MS)

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
