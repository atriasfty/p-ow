import { prisma } from "../client"

/**
 * Process Staff Milestones for a specific user and server.
 * This counts duty minutes WITHIN THE CURRENT QUOTA WEEK (Monday-Sunday).
 */
export async function processMilestones(userId: string, serverId: string) {
    try {
        const server = await prisma.server.findUnique({
            where: { id: serverId },
            select: { discordGuildId: true, milestoneChannelId: true, permLogChannelId: true }
        })
        if (!server || !server.discordGuildId) return

        // Calculate current week start (Monday)
        const now = new Date()
        const day = now.getDay()
        const diff = now.getDate() - day + (day === 0 ? -6 : 1)
        const weekStart = new Date(now)
        weekStart.setDate(diff)
        weekStart.setHours(0, 0, 0, 0)

        // 1. Calculate weekly duty time
        const aggregate = await prisma.shift.aggregate({
            where: {
                userId,
                serverId,
                endTime: { not: null },
                startTime: { gte: weekStart }
            },
            _sum: {
                duration: true
            }
        })

        const totalSeconds = aggregate._sum.duration || 0
        const totalMinutes = Math.floor(totalSeconds / 60)

        // 2. Fetch all milestones for this server
        const milestones = await prisma.staffMilestone.findMany({
            where: {
                serverId,
                requiredMinutes: { lte: totalMinutes }
            },
            orderBy: {
                requiredMinutes: 'desc'
            }
        })

        if (milestones.length === 0) return

        // 3. Find member to get their Discord ID
        const member = await prisma.member.findUnique({
            where: {
                userId_serverId: { userId, serverId }
            }
        })
        if (!member || !member.discordId) return

        // 4. For each milestone reached, ensure it's handled
        for (const milestone of milestones) {
            if (!milestone.rewardRoleId) continue

            // Debounce check
            const recentRequest = await prisma.botQueue.findFirst({
                where: {
                    serverId,
                    type: "ROLE_ADD",
                    targetId: member.discordId,
                    content: milestone.rewardRoleId,
                    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                }
            })

            if (recentRequest) continue

            // Add to queue
            await prisma.botQueue.create({
                data: {
                    serverId,
                    type: "ROLE_ADD",
                    targetId: member.discordId,
                    content: milestone.rewardRoleId
                }
            })

            // Log it in Discord (prefer milestoneChannelId, fallback to permLogChannelId)
            const logChannel = server.milestoneChannelId || server.permLogChannelId
            if (logChannel) {
                await prisma.botQueue.create({
                    data: {
                        serverId,
                        type: "MESSAGE",
                        targetId: logChannel,
                        content: JSON.stringify({
                            embeds: [{
                                title: "🏆 Weekly Milestone Reached",
                                description: `<@${member.discordId}> has reached the **${milestone.name}** milestone this week!`,
                                fields: [
                                    { name: "Weekly Duty Time", value: `${(totalMinutes / 60).toFixed(1)} hours`, inline: true },
                                    { name: "Reward", value: `<@&${milestone.rewardRoleId}> granted`, inline: true }
                                ],
                                color: 0x10b981,
                                timestamp: new Date().toISOString()
                            }]
                        })
                    }
                })
            }
        }
    } catch (e) {
        console.error("[MILESTONES] Error processing milestones:", e)
    }
}
