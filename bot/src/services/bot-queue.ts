import { Client, TextChannel } from "discord.js"
import { PrismaClient } from "@prisma/client"
import { getGlobalConfig } from "../lib/config"

export function startBotQueueService(client: Client, prisma: PrismaClient) {
    console.log(`Starting bot queue processor (dynamic interval)`)

    async function schedule() {
        try {
            await processQueue(client, prisma)
        } catch (e) {
            console.error("Bot queue processing error:", e)
        }
        const interval = await getGlobalConfig("QUEUE_INTERVAL_MS")
        setTimeout(schedule, interval)
    }

    schedule()
}

async function processQueue(client: Client, prisma: PrismaClient) {
    // 0. Reset items that have been stuck in PROCESSING for too long (e.g. worker crashed)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    await prisma.botQueue.updateMany({
        where: {
            status: "PROCESSING",
            updatedAt: { lt: fiveMinutesAgo }
        },
        data: {
            status: "PENDING"
        }
    })

    // 1. Mark PENDING items as PROCESSING atomically
    // We update up to 10 PENDING items to PROCESSING and retrieve them
    // This prevents other instances from picking up the same items
    const now = new Date()

    // Prisma doesn't support updateMany with return values on SQLite/MySQL easily without raw queries
    // So we fetch IDs first, then update them to PROCESSING if they still have PENDING status
    const pendingItems = await prisma.botQueue.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: 'asc' },
        take: 10,
        select: { id: true }
    })

    if (pendingItems.length === 0) return

    const itemsToProcess: any[] = []
    for (const item of pendingItems) {
        // updateMany allows conditional updates on non-unique fields
        const result = await prisma.botQueue.updateMany({
            where: { id: item.id, status: "PENDING" },
            data: { status: "PROCESSING" }
        })
        
        // If count > 0, THIS worker successfully locked the item
        if (result.count > 0) {
            const lockedItem = await prisma.botQueue.findUnique({ where: { id: item.id } })
            if (lockedItem) itemsToProcess.push(lockedItem)
        }
    }

    // Process items in parallel but with a small concurrency to avoid rate limits
    await Promise.all(itemsToProcess.map(async (item: any) => {
        try {
            // Check retry limit (using existing error column or just fail after 1 try for now)
            // If the item has failed too many times, we would ideally skip it.
            
            if (item.type === "MESSAGE") {
                const channel = await client.channels.fetch(item.targetId).catch(() => null)
                if (channel && (channel.isTextBased() || channel instanceof TextChannel)) {
                    let payload: any = item.content
                    try {
                        if (item.content.startsWith("{") && item.content.endsWith("}")) {
                            const parsed = JSON.parse(item.content)
                            if (parsed.embeds || parsed.content) payload = parsed
                        }
                    } catch (e) {}

                    await (channel as any).send(payload)

                    await prisma.botQueue.update({
                        where: { id: item.id },
                        data: { status: "SENT", processedAt: new Date() }
                    })
                } else {
                    throw new Error("Channel not found or not text-based")
                }
            } else if (item.type === "DM") {
                const user = await client.users.fetch(item.targetId).catch(() => null)
                if (user) {
                    await user.send(item.content)
                    await prisma.botQueue.update({
                        where: { id: item.id },
                        data: { status: "SENT", processedAt: new Date() }
                    })
                } else {
                    throw new Error("User not found")
                }
            } else if (item.type === "ROLE_ADD") {
                // item.serverId is the database CUID, we need the Discord Guild ID
                const server = await prisma.server.findUnique({ where: { id: item.serverId } })
                if (!server || !server.discordGuildId) throw new Error("Server or Discord Guild ID not found")

                const guild = await client.guilds.fetch(server.discordGuildId).catch(() => null)
                if (!guild) throw new Error("Guild not found in Discord cache/API")

                const member = await guild.members.fetch(item.targetId).catch(() => null)
                if (!member) throw new Error("Member not found in guild")

                await member.roles.add(item.content)
                await prisma.botQueue.update({
                    where: { id: item.id },
                    data: { status: "SENT", processedAt: new Date() }
                })
            }
        } catch (error: any) {
            console.error(`[QUEUE] Failed to process item ${item.id}:`, error.message || error)
            await prisma.botQueue.update({
                where: { id: item.id },
                data: {
                    status: "FAILED",
                    error: error.message || "Unknown error",
                    processedAt: new Date()
                }
            })
        }
    }))
}
