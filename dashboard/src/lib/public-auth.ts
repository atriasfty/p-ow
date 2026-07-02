import { prisma } from "./db"
import { Prisma } from "@prisma/client"
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
        // Trust cf-connecting-ip (Cloudflare; nginx must strip it from direct connections).
        // Fall back to the LAST XFF entry (appended by our proxy). Never trust XFF[0].
        const xff = head.get("x-forwarded-for")
        const lastXff = xff ? xff.split(",").at(-1)?.trim() : undefined
        const incomingIp = head.get("cf-connecting-ip") || lastXff || head.get("x-real-ip") || "unknown"
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

    const plan = apiKey.server?.subscriptionPlan || (apiKey.serverId ? "free" : "pow-max")
    const limits: Record<string, number> = {
        "free": 250,
        "pow-pro": 5000,
        "pow-max": 1_000_000_000
    }
    const maxDaily = limits[plan] || 250

    // Enforce GLOBALLY per server instead of per-key
    const configKey = apiKey.serverId ? `SERVER_QUOTA_${apiKey.serverId}` : `GLOBAL_QUOTA_${apiKey.id}`

    // Both the frequency check and the daily quota are check-then-write against
    // shared rows, so they must run inside one Serializable transaction — otherwise
    // concurrent requests can all read the same "not yet over limit" state and all
    // slip through before any of their writes land, silently bypassing the limit.
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Frequency Check (rateLimit in seconds) — re-read lastUsed inside the
            // transaction so we're checking against the freshest committed value.
            const freshKey = await tx.apiKey.findUnique({ where: { id: apiKey.id }, select: { lastUsed: true } })
            if (freshKey?.lastUsed) {
                const secondsSinceLast = (now.getTime() - new Date(freshKey.lastUsed).getTime()) / 1000
                if (secondsSinceLast < apiKey.rateLimit) {
                    return { valid: false, error: `Rate limit exceeded. Wait ${Math.ceil(apiKey.rateLimit - secondsSinceLast)}s.`, status: 429 } as const
                }
            }

            // 2. Daily Quota Check (Based on Server Plan)
            const quotaConfig = await tx.config.findUnique({ where: { key: configKey } })

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
                } as const
            }

            // Update global state tracking
            await tx.config.upsert({
                where: { key: configKey },
                update: { value: JSON.stringify({ usageCount: usageCount + 1, resetAt }) },
                create: { key: configKey, value: JSON.stringify({ usageCount: usageCount + 1, resetAt }) }
            })

            // Keep individual key frequency tracker active
            await tx.apiKey.update({
                where: { id: apiKey.id },
                data: { lastUsed: now }
            })

            return {
                valid: true,
                apiKey,
                rateLimitRemaining: maxDaily >= 1_000_000_000 ? 999999 : maxDaily - (usageCount + 1),
                rateLimitReset: Math.floor(resetAt.getTime() / 1000)
            } as const
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

        return result
    } catch (e: any) {
        if (e.code === "P2034") {
            // Serialization conflict with a concurrent request — safe default is to
            // reject this one rather than risk double-counting or a bypass.
            return { valid: false, error: "Too many concurrent requests, please retry.", status: 429 }
        }
        throw e
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
    const ip = head.get("cf-connecting-ip") || lastXff || head.get("x-real-ip") || "unknown"

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
