import { prisma } from "./db"
import { lookup } from "dns/promises"
import * as net from "net"
import * as https from "https"

export type WebhookEvent =
    | "PUNISHMENT_CREATED"
    | "SHIFT_START"
    | "SHIFT_END"
    | "BOLO_CREATED"
    | "LOA_REQUESTED"

export interface WebhookEmbed {
    title?: string
    description?: string
    color?: number
    fields?: { name: string, value: string, inline?: boolean }[]
    footer?: { text: string }
    timestamp?: string
}

/**
 * Checks an IPv4/IPv6 address against private, loopback, link-local, CGNAT,
 * benchmark, and IPv4-mapped-IPv6 ranges. Block everything that isn't a
 * globally routable public address.
 */
function isPrivateIp(ip: string): boolean {
    const lower = ip.toLowerCase()

    // IPv4-mapped IPv6 (::ffff:127.0.0.1, ::ffff:10.0.0.1, …)
    const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
    if (mapped) return isPrivateIp(mapped[1])

    if (net.isIPv4(ip)) {
        const parts = ip.split(".").map(Number)
        if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return true
        const [a, b] = parts
        return (
            a === 0 ||                              // 0.0.0.0/8
            a === 10 ||                             // 10.0.0.0/8
            a === 127 ||                            // 127.0.0.0/8 loopback
            (a === 169 && b === 254) ||             // 169.254.0.0/16 link-local
            (a === 172 && b >= 16 && b <= 31) ||    // 172.16.0.0/12
            (a === 192 && b === 168) ||             // 192.168.0.0/16
            (a === 100 && b >= 64 && b <= 127) ||   // 100.64.0.0/10 CGNAT
            (a === 198 && (b === 18 || b === 19)) ||// 198.18.0.0/15 benchmark
            a === 224 || a >= 240                   // multicast + reserved
        )
    }

    if (net.isIPv6(ip)) {
        return (
            lower === "::" ||
            lower === "::1" ||
            lower.startsWith("fe80:") ||
            lower.startsWith("fc") ||
            lower.startsWith("fd")
        )
    }

    // Unparseable -> reject
    return true
}

/**
 * Resolves a hostname and returns the first public IP, or null if none/blocked.
 * The caller pins the connection to this exact IP via the http/https `lookup`
 * option so DNS cannot rebind between validation and fetch.
 */
async function resolvePublicIp(hostname: string): Promise<{ address: string, family: 4 | 6 } | null> {
    if (hostname === "localhost" || hostname === "0.0.0.0") return null
    if (net.isIP(hostname)) {
        if (isPrivateIp(hostname)) return null
        return { address: hostname, family: net.isIPv4(hostname) ? 4 : 6 }
    }
    try {
        const records = await lookup(hostname, { all: true })
        for (const r of records) {
            if (!isPrivateIp(r.address)) return { address: r.address, family: r.family as 4 | 6 }
        }
    } catch { /* fall through */ }
    return null
}

/**
 * Post JSON to a webhook URL with hardened transport:
 *   - Only https://
 *   - Resolve DNS once, reject private/loopback/link-local/CGNAT/v4-mapped-v6
 *   - Pin the TCP connection to the validated IP (no DNS rebinding)
 *   - 5s timeout, max 64KB response body
 */
function postWebhook(targetUrl: URL, ip: string, family: 4 | 6, payload: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const opts: https.RequestOptions = {
            method: "POST",
            host: targetUrl.hostname,
            port: targetUrl.port || 443,
            path: `${targetUrl.pathname}${targetUrl.search}`,
            servername: targetUrl.hostname, // SNI still matches the original hostname
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload).toString(),
                Host: targetUrl.host
            },
            lookup: (_h: string, _o: any, cb: any) => cb(null, ip, family),
            timeout: 5000
        }

        const req = https.request(opts, (res) => {
            let bytes = 0
            res.on("data", chunk => {
                bytes += chunk.length
                if (bytes > 64 * 1024) {
                    req.destroy(new Error("Webhook response too large"))
                }
            })
            res.on("end", () => resolve())
            res.on("error", reject)
        })

        req.on("timeout", () => req.destroy(new Error("Webhook request timed out")))
        req.on("error", reject)
        req.write(payload)
        req.end()
    })
}

export async function fireWebhook(serverId: string, event: WebhookEvent, embed: WebhookEmbed) {
    try {
        const server = (await prisma.server.findUnique({
            where: { id: serverId },
            select: { webhookUrl: true, webhookEvents: true }
        })) as any

        if (!server?.webhookUrl) return

        const enabledEvents = server.webhookEvents ? JSON.parse(server.webhookEvents) : []
        if (!enabledEvents.includes(event)) return

        let parsed: URL
        try {
            parsed = new URL(server.webhookUrl)
        } catch {
            console.error(`[WEBHOOK] Malformed webhookUrl for server ${serverId}`)
            return
        }
        if (parsed.protocol !== "https:") {
            console.error(`[WEBHOOK] Non-https webhookUrl blocked for ${serverId}`)
            return
        }

        const resolved = await resolvePublicIp(parsed.hostname)
        if (!resolved) {
            console.error(`[WEBHOOK] Blocked private/unresolvable host for ${serverId}: ${parsed.hostname}`)
            return
        }

        if (!embed.color) embed.color = 0x6366f1
        if (!embed.timestamp) embed.timestamp = new Date().toISOString()
        if (!embed.footer) embed.footer = { text: "Project Overwatch Webhook Notifications" }

        const payload = JSON.stringify({ embeds: [embed] })
        await postWebhook(parsed, resolved.address, resolved.family, payload)
    } catch (e) {
        console.error(`[WEBHOOK] Failed to fire ${event} for ${serverId}:`, e)
    }
}
