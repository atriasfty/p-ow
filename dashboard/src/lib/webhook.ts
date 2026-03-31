import { prisma } from "./db"

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

export async function fireWebhook(serverId: string, event: WebhookEvent, embed: WebhookEmbed) {
    try {
        const server = (await prisma.server.findUnique({
            where: { id: serverId },
            select: { webhookUrl: true, webhookEvents: true }
        })) as any

        if (!server?.webhookUrl) return

        const enabledEvents = server.webhookEvents ? JSON.parse(server.webhookEvents) : []
        if (!enabledEvents.includes(event)) return

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
