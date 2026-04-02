import { prisma } from "../client"

/**
 * Periodically checks for servers scheduled for deletion and removes them if the grace period has passed.
 * Per PRC policy, servers are deleted 24 hours after the bot is kicked.
 */
export async function startServerCleanupJob() {
    console.log("Starting automated server cleanup job...")

    // Run every hour
    setInterval(async () => {
        try {
            const now = new Date()

            // Find servers where deletionScheduledAt is in the past
            const serversToDelete = await prisma.server.findMany({
                where: {
                    deletionScheduledAt: {
                        not: null,
                        lt: now
                    }
                },
                select: {
                    id: true,
                    customName: true,
                    discordGuildId: true
                }
            })

            if (serversToDelete.length > 0) {
                console.log(`[Cleanup] Found ${serversToDelete.length} servers scheduled for deletion.`)

                for (const server of serversToDelete) {
                    console.log(`[Cleanup] Deleting server: ${server.customName} (${server.id}) for Discord Guild: ${server.discordGuildId}`)

                    // Delete the server and all related data (Prisma should handle cascades if configured, 
                    // but we should be careful here. Assuming the schema has appropriate deletions.)
                    await prisma.server.delete({
                        where: { id: server.id }
                    })

                    console.log(`[Cleanup] Successfully deleted server: ${server.id}`)
                }
            }
        } catch (error) {
            console.error("[Cleanup] Error in server cleanup job:", error)
        }
    }, 60 * 60 * 1000) // 1 hour

    // Also run once on startup
    const now = new Date()
    const serversToDelete = await prisma.server.findMany({
        where: {
            deletionScheduledAt: {
                not: null,
                lt: now
            }
        }
    })

    if (serversToDelete.length > 0) {
        console.log(`[Cleanup] Startup: Found ${serversToDelete.length} pending deletions.`)
        for (const server of serversToDelete) {
            await prisma.server.delete({ where: { id: server.id } })
        }
    }
}
