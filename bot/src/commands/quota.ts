import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from "discord.js"
import { prisma } from "../client"
import { getBotServerSettings } from "../lib/server-settings"

/**
 * Compute the start of the current period using server settings.
 * Replicates the logic from milestones.ts so the quota command respects the
 * same week-start-day / timezone / period-type configuration.
 */
function getPeriodStart(weekStartDay: number, timezone: string): Date {
    const now = new Date()

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

export async function handleQuotaCommand(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand()

    if (subcommand === "status") {
        const discordId = interaction.user.id
        await interaction.deferReply({ ephemeral: true })

        // 1. Find all possible internal User IDs for this Discord user (Clerk sync)
        const members = await prisma.member.findMany({
            where: { discordId },
            include: { server: true, role: true }
        })

        if (members.length === 0) {
            return interaction.editReply({ content: "You do not have any registered accounts on Project Overwatch." })
        }

        const clerkUserIds = Array.from(new Set(members.map((m: any) => m.userId)))

        // Load settings for the first server (used for week boundary — covers the common case
        // where all a user's servers share the same quota settings)
        const firstServerId = members[0].server.id
        const s = await getBotServerSettings(firstServerId)
        const weekStart = getPeriodStart(s.quotaWeekStartDay, s.quotaTimezone)

        // Get Global Time across all possible user IDs
        const shifts = await prisma.shift.findMany({
            where: {
                userId: { in: clerkUserIds },
                startTime: { gte: weekStart },
                endTime: { not: null }
            }
        })

        // Active shifts: include ALL active shifts (regardless of start time) so long
        // shifts that crossed the week boundary are still counted from weekStart onwards
        const activeShifts = await prisma.shift.findMany({
            where: {
                userId: { in: clerkUserIds },
                endTime: null
            }
        })

        // Calc total seconds from completed shifts
        let totalSeconds = shifts.reduce((acc: number, s: any) => acc + (s.duration || 0), 0)

        // Add active shifts current duration, counting only time within the current period
        const currentTimestamp = Date.now()
        activeShifts.forEach((s: any) => {
            const effectiveStart = Math.max(weekStart.getTime(), s.startTime.getTime())
            totalSeconds += Math.floor((currentTimestamp - effectiveStart) / 1000)
        })

        const totalMinutes = Math.floor(totalSeconds / 60)

        const embed = new EmbedBuilder()
            .setTitle("Weekly Quota Status (Global)")
            .setDescription(`**Total Time This Week:** ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`)
            .setColor(0x3b82f6)

        if (members.length === 0) {
            embed.addFields({ name: "Info", value: "You are not a member of any servers." })
        } else {
            members.forEach((m: any) => {
                const req = m.role?.quotaMinutes || 0
                if (req === 0) return // Skip if no quota

                const met = totalMinutes >= req
                const remaining = Math.max(0, req - totalMinutes)
                const remainingHours = Math.floor(remaining / 60)
                const remainingMins = remaining % 60
                const status = met ? "✅ Met" : `❌ ${remainingHours}h ${remainingMins}m remaining`

                embed.addFields({
                    name: m.server.customName || m.server.name,
                    value: `Quota: ${Math.floor(req / 60)}h ${req % 60}m\nStatus: ${status}`,
                    inline: true
                })
            })
        }

        await interaction.editReply({ embeds: [embed] })

    } else if (subcommand === "leaderboard") {
        const discordId = interaction.user.id
        await interaction.deferReply({ ephemeral: true })

        // Check global view quota permission
        const authMembers = await prisma.member.findMany({
            where: { discordId },
            include: { role: true }
        })

        const canView = authMembers.some((m: any) => m.isAdmin || (m.role && m.role.canViewQuota))
        if (!canView) {
            return interaction.editReply({ content: "You do not have permission to view the global quota leaderboard." })
        }

        // Load settings from the invoker's first server for period boundaries
        const settingsServerId = authMembers[0]?.serverId
        const s = settingsServerId ? await getBotServerSettings(settingsServerId) : null
        const weekStart = s
            ? getPeriodStart(s.quotaWeekStartDay, s.quotaTimezone)
            : (() => {
                // Fallback: Monday UTC midnight
                const now = new Date()
                const day = now.getUTCDay()
                const diff = (day === 0 ? -6 : 1) - day
                return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff))
            })()

        // 1. Get all members across ALL servers (include discordId for mentions)
        const members = await prisma.member.findMany({
            include: { role: true, server: true }
        })

        if (members.length === 0) {
            return interaction.editReply({ content: "No members found." })
        }

        // Deduplicate members by userId (same person may be in multiple servers)
        const uniqueMembers = new Map<string, any>()
        for (const m of members) {
            // Keep the member with the highest quota requirement
            const existing = uniqueMembers.get(m.userId)
            if (!existing || (m.role?.quotaMinutes || 0) > (existing.role?.quotaMinutes || 0)) {
                uniqueMembers.set(m.userId, m)
            }
        }

        const memberList = Array.from(uniqueMembers.values())
        const memberIds = memberList.map((m: any) => m.userId)

        // 2. Get Aggregated Global Time for these users
        const aggregations = await prisma.shift.groupBy({
            by: ['userId'],
            where: {
                userId: { in: memberIds },
                startTime: { gte: weekStart },
                endTime: { not: null }
            },
            _sum: { duration: true }
        })

        // Map userId -> minutes
        const userTimeMap = new Map<string, number>()
        aggregations.forEach((a: any) => {
            userTimeMap.set(a.userId, Math.floor((a._sum.duration || 0) / 60))
        })

        // Add currently active shift time (only the portion within the current period)
        const activeShifts = await prisma.shift.findMany({
            where: { userId: { in: memberIds }, endTime: null },
            select: { userId: true, startTime: true }
        })
        const currentTimestamp = Date.now()
        activeShifts.forEach((a: any) => {
            const effectiveStart = Math.max(weekStart.getTime(), a.startTime.getTime())
            const activeMinutes = Math.floor((currentTimestamp - effectiveStart) / 1000 / 60)
            userTimeMap.set(a.userId, (userTimeMap.get(a.userId) || 0) + activeMinutes)
        })

        // 3. Build leaderboard with all members
        const leaderboard = memberList.map((m: any) => {
            const mins = userTimeMap.get(m.userId) || 0
            const quotaMins = m.role?.quotaMinutes || 0
            const hasQuota = quotaMins > 0
            const metQuota = hasQuota ? mins >= quotaMins : true
            const remaining = hasQuota ? Math.max(0, quotaMins - mins) : 0
            const completionPct = hasQuota ? (mins / quotaMins) : (mins > 0 ? 999 : 0) // 999 = no quota but has time

            return {
                discordId: m.discordId, // Discord ID for mentions
                userId: m.userId, // Fallback if no Discord ID
                mins,
                quotaMins,
                hasQuota,
                metQuota,
                remaining,
                completionPct
            }
        })

        // Sort: quota completion % (desc), then by time worked (desc)
        leaderboard.sort((a: any, b: any) => {
            if (b.completionPct !== a.completionPct) {
                return b.completionPct - a.completionPct
            }
            return b.mins - a.mins
        })

        // 4. Build description
        const lines: string[] = []
        for (const [i, entry] of leaderboard.entries()) {
            const h = Math.floor(entry.mins / 60)
            const m = entry.mins % 60
            const timeWorked = `${h}h ${m}m`

            // Mention: prefer Discord ID, fallback to showing userId
            const mention = entry.discordId ? `<@${entry.discordId}>` : `\`${entry.userId}\``

            if (!entry.hasQuota) {
                // No quota assigned
                lines.push(`**${i + 1}.** ${mention} - ${timeWorked} *(No quota)*`)
            } else {
                const reqH = Math.floor(entry.quotaMins / 60)
                const reqM = entry.quotaMins % 60
                const quotaStr = `${reqH}h ${reqM}m`

                if (entry.metQuota) {
                    lines.push(`**${i + 1}.** ${mention} - ${timeWorked} / ${quotaStr} ✅`)
                } else {
                    const remH = Math.floor(entry.remaining / 60)
                    const remM = entry.remaining % 60
                    lines.push(`**${i + 1}.** ${mention} - ${timeWorked} / ${quotaStr} ❌ *(${remH}h ${remM}m left)*`)
                }
            }
        }

        // Handle Discord's 4096 character limit for embed descriptions
        let desc = lines.join("\n")
        if (desc.length > 4000) {
            // Truncate and add note
            const truncatedLines: string[] = []
            let charCount = 0
            for (const line of lines) {
                if (charCount + line.length + 1 > 3900) {
                    truncatedLines.push(`\n*... and ${lines.length - truncatedLines.length} more members*`)
                    break
                }
                truncatedLines.push(line)
                charCount += line.length + 1
            }
            desc = truncatedLines.join("\n")
        }

        if (desc === "") desc = "No members found."

        const embed = new EmbedBuilder()
            .setTitle(`Global Quota Leaderboard`)
            .setDescription(desc)
            .setColor(0xf59e0b) // Amber
            .setFooter({ text: `${memberList.length} unique members • Week of ${weekStart.toLocaleDateString()}` })

        await interaction.editReply({ embeds: [embed] })
    }
}
