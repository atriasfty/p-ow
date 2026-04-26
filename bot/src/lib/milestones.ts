import { prisma } from "../client"
import { getBotServerSettings } from "./server-settings"

/**
 * Process Staff Milestones for a specific user and server.
 * Respects per-server settings for period type, week start day, timezone,
 * debounce hours, and embed appearance.
 */
export async function processMilestones(userId: string, serverId: string) {
    try {
        const [server, s] = await Promise.all([
            prisma.server.findUnique({
                where: { id: serverId },
                select: { discordGuildId: true, milestoneChannelId: true, permLogChannelId: true }
            }),
            getBotServerSettings(serverId)
        ])
        if (!server || !server.discordGuildId) return

        // Calculate period start using configured settings
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

        // 4. For each milestone reached, check debounce and queue notifications
        const debounceMs = s.milestoneDebounceHours * 60 * 60 * 1000

        for (const milestone of milestones) {
            if (!milestone.rewardRoleId) continue

            // Debounce: check if we've already queued a ROLE_ADD within the debounce window
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

            // Add role to queue
            await prisma.botQueue.create({
                data: {
                    serverId,
                    type: "ROLE_ADD",
                    targetId: member.discordId,
                    content: milestone.rewardRoleId
                }
            })

            // Log in Discord (prefer milestoneChannelId, fallback to permLogChannelId)
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
 * All boundaries are computed as timezone-local midnight, converted to UTC.
 */
function getPeriodStart(periodType: 'weekly' | 'monthly' | 'lifetime', weekStartDay: number, timezone: string): Date {
    const now = new Date()

    if (periodType === 'lifetime') {
        return new Date(0)
    }

    if (periodType === 'monthly') {
        try {
            const fmt = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                year: 'numeric',
                month: 'numeric'
            })
            const parts = fmt.formatToParts(now)
            const year = parseInt(parts.find(p => p.type === 'year')?.value ?? '2000')
            const month = parseInt(parts.find(p => p.type === 'month')?.value ?? '1')
            return getMidnightUTC(year, month, 1, timezone)
        } catch {
            return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        }
    }

    // Weekly
    try {
        const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'short',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        })
        const parts = fmt.formatToParts(now)
        const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
        const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? 'Mon'
        const currentDayOfWeek = weekdayMap[weekdayStr] ?? now.getDay()
        const diff = (currentDayOfWeek - weekStartDay + 7) % 7

        const year = parseInt(parts.find(p => p.type === 'year')?.value ?? '2000')
        const month = parseInt(parts.find(p => p.type === 'month')?.value ?? '1')
        const day = parseInt(parts.find(p => p.type === 'day')?.value ?? '1')

        const startUtc = new Date(Date.UTC(year, month - 1, day - diff))
        return getMidnightUTC(startUtc.getUTCFullYear(), startUtc.getUTCMonth() + 1, startUtc.getUTCDate(), timezone)
    } catch {
        // Fallback: Monday UTC midnight
        const day = now.getUTCDay()
        const diff = (day === 0 ? -6 : 1) - day
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff))
    }
}

/**
 * Return the UTC Date that corresponds to 00:00:00 in `timezone` on the given
 * year/month/day (in the local calendar of that timezone).
 *
 * Strategy: anchor at noon UTC on the target date, read back the local time
 * shown in the timezone, and subtract it from noon to get UTC midnight.
 * A day-difference correction handles timezones far from UTC (e.g. UTC±12/13).
 */
function getMidnightUTC(year: number, month: number, day: number, timezone: string): Date {
    const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))

    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
    })
    const parts = fmt.formatToParts(noonUTC)

    let h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '12')
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
    const s = parseInt(parts.find(p => p.type === 'second')?.value ?? '0')
    if (h === 24) h = 0

    const localDay = parseInt(parts.find(p => p.type === 'day')?.value ?? String(day))
    const localMonth = parseInt(parts.find(p => p.type === 'month')?.value ?? String(month))
    const localYear = parseInt(parts.find(p => p.type === 'year')?.value ?? String(year))

    const localDateMs = Date.UTC(localYear, localMonth - 1, localDay)
    const targetDateMs = Date.UTC(year, month - 1, day)
    const dayDiffMs = localDateMs - targetDateMs

    return new Date(noonUTC.getTime() - (h * 3600 + m * 60 + s) * 1000 - dayDiffMs)
}
