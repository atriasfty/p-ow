import { prisma } from "./db"
import { headers } from "next/headers"

export interface PublicAuthResult {
    valid: boolean
    apiKey?: any
    error?: string
    status?: number
    rateLimitRemaining?: number
    rateLimitReset?: number
}

/**
 * Validates the API key from the Authorization header.
 * Usage: Authorization: Bearer <key>
 */
export async function validatePublicApiKey(): Promise<PublicAuthResult> {
    const head = await headers()
    const authHeader = head.get("authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return { valid: false, error: "Missing or invalid Authorization header", status: 401 }
    }

    const key = authHeader.replace("Bearer ", "").trim()

    const apiKey = await prisma.apiKey.findUnique({
        where: { key },
        include: { server: { select: { subscriptionPlan: true } } }
    })

    if (!apiKey || !apiKey.enabled) {
        return { valid: false, error: "Invalid or disabled API key", status: 401 }
    }

    // --- IP ALLOWLIST CHECK ---
    if (apiKey.allowedIps) {
        // Prefer trusted proxy-set headers; last XFF entry is appended by our own proxy (client cannot forge it)
        const xff = head.get("x-forwarded-for")
        const lastXff = xff ? xff.split(",").at(-1)?.trim() : undefined
        const incomingIp = head.get("cf-connecting-ip") || head.get("x-real-ip") || lastXff || "unknown"
        const allowedList = apiKey.allowedIps.split(",").map((ip: string) => ip.trim()).filter(Boolean)

        if (allowedList.length > 0 && !allowedList.includes(incomingIp)) {
            // Log the unauthorized attempt
            await prisma.securityLog.create({
                data: {
                    event: "PUBLIC_API_BLOCKED_IP",
                    ip: incomingIp,
                    details: `Key: ${apiKey.name} (${apiKey.id}) | Blocked IP: ${incomingIp}`,
                    serverId: apiKey.serverId
                }
            }).catch(() => { })

            return { valid: false, error: "Access denied: IP address not in allowlist", status: 403 }
        }
    }

    // --- RATE LIMITING & QUOTAS ---
    const now = new Date()

    // 1. Frequency Check (rateLimit in seconds)
    if (apiKey.lastUsed) {
        const secondsSinceLast = (now.getTime() - new Date(apiKey.lastUsed).getTime()) / 1000
        if (secondsSinceLast < apiKey.rateLimit) {
            return { valid: false, error: `Rate limit exceeded. Wait ${Math.ceil(apiKey.rateLimit - secondsSinceLast)}s.`, status: 429 }
        }
    }

    // 2. Daily Quota Check (Based on Server Plan)
    const plan = apiKey.server?.subscriptionPlan || (apiKey.serverId ? "free" : "pow-max")
    const limits: Record<string, number> = {
        "free": 250,
        "pow-pro": 5000,
        "pow-max": 1_000_000_000
    }
    const maxDaily = limits[plan] || 250

    // Enforce GLOBALLY per server instead of per-key
    const configKey = apiKey.serverId ? `SERVER_QUOTA_${apiKey.serverId}` : `GLOBAL_QUOTA_${apiKey.id}`
    const quotaConfig = await prisma.config.findUnique({ where: { key: configKey } })

    let usageCount = 0
    let resetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    if (quotaConfig) {
        try {
            const data = JSON.parse(quotaConfig.value)
            if (now < new Date(data.resetAt)) {
                usageCount = data.usageCount
                resetAt = new Date(data.resetAt)
            }
        } catch (e) { }
    }

    if (usageCount >= maxDaily) {
        return {
            valid: false,
            error: `Daily server quota exceeded (${usageCount}/${maxDaily}). Upgrade your server plan for higher limits.`,
            status: 429,
            rateLimitRemaining: 0,
            rateLimitReset: Math.floor(resetAt.getTime() / 1000)
        }
    }

    // Update global state tracking
    await prisma.config.upsert({
        where: { key: configKey },
        update: { value: JSON.stringify({ usageCount: usageCount + 1, resetAt }) },
        create: { key: configKey, value: JSON.stringify({ usageCount: usageCount + 1, resetAt }) }
    }).catch(() => { })

    // Keep individual key frequency tracker active
    await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsed: now }
    }).catch(() => { })

    return {
        valid: true,
        apiKey,
        rateLimitRemaining: maxDaily >= 1_000_000_000 ? 999999 : maxDaily - (usageCount + 1),
        rateLimitReset: Math.floor(resetAt.getTime() / 1000)
    }
}

/**
 * Resolves the server associated with the API key, enforcing tenant isolation.
 * Ignores any requested name to ensure the key can only access its own server.
 */
export async function resolveServer(apiKey: any) {
    if (!apiKey || !apiKey.serverId) return null

    return await prisma.server.findUnique({
        where: { id: apiKey.serverId }
    })
}

/**
 * Logs an API access event for security auditing.
 */
export async function logApiAccess(apiKey: any, event: string, details?: string) {
    const head = await headers()
    const xff = head.get("x-forwarded-for")
    const lastXff = xff ? xff.split(",").at(-1)?.trim() : undefined
    const ip = head.get("cf-connecting-ip") || head.get("x-real-ip") || lastXff || "unknown"

    await prisma.securityLog.create({
        data: {
            event,
            ip,
            details: details || `Key: ${apiKey.name} (${apiKey.id})`,
            serverId: apiKey.serverId
        }
    }).catch(() => { })
}

/**
 * Wraps a NextResponse with the appropriate Rate Limit headers.
 */
export function withRateLimit(response: any, auth: PublicAuthResult) {
    if (auth.rateLimitRemaining !== undefined) {
        response.headers.set("X-RateLimit-Remaining", auth.rateLimitRemaining.toString())
    }
    if (auth.rateLimitReset !== undefined) {
        response.headers.set("X-RateLimit-Reset", auth.rateLimitReset.toString())
    }
    return response
}
