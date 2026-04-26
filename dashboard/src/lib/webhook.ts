import { prisma } from "./db"
import { lookup } from "dns/promises"

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

function isPrivateIp(ip: string): boolean {
    return [
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^169\.254\./,
        /^0\./,
        /^::1$/,
        /^fe80:/i,
        /^fc00:/i,
        /^fd[0-9a-f]{2}:/i,
    ].some(r => r.test(ip))
}

async function validateWebhookUrl(url: string): Promise<boolean> {
    try {
        const parsed = new URL(url)
        if (parsed.protocol !== "https:") return false

        const hostname = parsed.hostname
        if (hostname === "localhost" || hostname === "0.0.0.0") return false

        const resolved = await lookup(hostname, { all: true }).catch(() => [])
        if (resolved.length === 0) return false

        return !resolved.some(r => isPrivateIp(r.address))
    } catch {
        return false
    }
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

        const isSafe = await validateWebhookUrl(server.webhookUrl)
        if (!isSafe) {
            console.error(`[WEBHOOK] Blocked unsafe webhookUrl for server ${serverId}: ${server.webhookUrl}`)
            return
        }

        // Dark indigo color for Project Overwatch
        if (!embed.color) embed.color = 0x6366f1
        if (!embed.timestamp) embed.timestamp = new Date().toISOString()
        if (!embed.footer) embed.footer = { text: "Project Overwatch Webhook Notifications" }

        await fetch(server.webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                embeds: [embed]
            })
        })
    } catch (e) {
        console.error(`[WEBHOOK] Failed to fire ${event} for ${serverId}:`, e)
    }
}
