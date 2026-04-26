import { prisma } from "@/lib/db"
import { getServerSettings } from "@/lib/server-settings"

/**
 * Process Staff Milestones for a specific user and server.
 * Week/period boundaries respect per-server quotaWeekStartDay and quotaTimezone settings.
 */
export async function processMilestones(userId: string, serverId: string) {
    try {
        const [server, s] = await Promise.all([
            prisma.server.findUnique({
                where: { id: serverId },
                select: { discordGuildId: true, milestoneChannelId: true, permLogChannelId: true }
            }),
            getServerSettings(serverId)
        ])
        if (!server || !server.discordGuildId) return

        // Calculate period start based on configured quotaWeekStartDay / quotaTimezone
        const periodStart = getPeriodStart(s.milestonePeriodType, s.quotaWeekStartDay, s.quotaTimezone)

        // 1. Calculate duty time within the current period
        const aggregate = await prisma.shift.aggregate({
            where: {
                userId,
                serverId,
                endTime: { not: null },
                startTime: { gte: periodStart }
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
        const debounceMs = s.milestoneDebounceHours * 60 * 60 * 1000

        for (const milestone of milestones) {
            if (!milestone.rewardRoleId) continue

            // Debounce: check if we've already sent a ROLE_ADD for this milestone within the debounce window
            const recentRequest = await prisma.botQueue.findFirst({
                where: {
                    serverId,
                    type: "ROLE_ADD",
                    targetId: member.discordId,
                    content: milestone.rewardRoleId,
                    createdAt: { gte: new Date(Date.now() - debounceMs) }
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

            // Log it in Discord if a channel is set (prefer milestoneChannelId, fallback to permLogChannelId)
            const logChannel = server.milestoneChannelId || server.permLogChannelId
            if (logChannel) {
                await prisma.botQueue.create({
                    data: {
                        serverId,
                        type: "MESSAGE",
                        targetId: logChannel,
                        content: JSON.stringify({
                            embeds: [{
                                title: s.milestoneEmbedTitle,
                                description: `<@${member.discordId}> has reached the **${milestone.name}** milestone!`,
                                fields: [
                                    { name: "Duty Time This Period", value: `${(totalMinutes / 60).toFixed(1)} hours`, inline: true },
                                    { name: "Reward", value: `<@&${milestone.rewardRoleId}> granted`, inline: true }
                                ],
                                color: s.milestoneEmbedColor,
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

/**
 * Calculate the start of the current period based on type, week start day and timezone.
 */
function getPeriodStart(periodType: 'weekly' | 'monthly' | 'lifetime', weekStartDay: number, timezone: string): Date {
    const now = new Date()

    if (periodType === 'lifetime') {
        return new Date(0) // Unix epoch — count everything
    }

    if (periodType === 'monthly') {
        // Start of current month in the configured timezone
        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            })
            const parts = formatter.formatToParts(now)
            const year = parts.find(p => p.type === 'year')?.value
            const month = parts.find(p => p.type === 'month')?.value
            if (year && month) {
                return new Date(`${year}-${month}-01T00:00:00.000Z`)
            }
        } catch { /* fall through */ }
        // Fallback: UTC month start
        return new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // Weekly
    try {
        const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })
        const parts = formatter.formatToParts(now)
        const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
        const weekdayStr = parts.find(p => p.type === 'weekday')?.value || 'Mon'
        const currentDayOfWeek = weekdayMap[weekdayStr] ?? now.getDay()

        const diff = (currentDayOfWeek - weekStartDay + 7) % 7
        const startDate = new Date(now)
        startDate.setDate(now.getDate() - diff)
        startDate.setHours(0, 0, 0, 0)
        return startDate
    } catch {
        // Fallback: Monday UTC
        const day = now.getDay()
        const diff = now.getDate() - day + (day === 0 ? -6 : 1)
        const weekStart = new Date(now)
        weekStart.setDate(diff)
        weekStart.setHours(0, 0, 0, 0)
        return weekStart
    }
}
