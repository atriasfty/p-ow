import crypto from "crypto"

// Shared secret for HMAC verification - must match Vision desktop app
// Fallback to hardcoded value if env var not set (for development/first deploys)
const VISION_HMAC_SECRET = process.env.VISION_HMAC_SECRET || 'pow-vision-hmac-secret-2024'

/**
 * Verifies the HMAC signature from Vision app headers.
 * Format: X-Vision-Sig: timestamp:instanceId:signature
 * Signature = HMAC-SHA256(timestamp:instanceId, secret)
 */
export function verifyVisionSignature(header: string | null): boolean {
    if (!header) return false

    const parts = header.split(':')
    if (parts.length !== 3) return false

    const [timestamp, instanceId, signature] = parts
    const ts = parseInt(timestamp, 10)

    // Check timestamp is within 5 minutes (allows for clock drift)
    const now = Date.now()
    if (isNaN(ts) || Math.abs(now - ts) > 300000) {
        return false
    }

    // Compute expected signature
    const message = `${timestamp}:${instanceId}`
    const expectedSig = crypto
        .createHmac('sha256', VISION_HMAC_SECRET)
        .update(message)
        .digest('hex')

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expectedSig)

    if (sigBuffer.length !== expectedBuffer.length) {
        return false
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer)
}

export const visionCorsHeaders = {
    // Note: Desktop app origins can vary (file://, http://localhost, etc.)
    // For maximum security in production, this should be restricted to known origins
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Vision-Sig"
}
