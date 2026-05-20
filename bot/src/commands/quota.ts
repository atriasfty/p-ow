import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from "discord.js"
import { prisma } from "../client"
import { getBotServerSettings } from "../lib/server-settings"
import { getWeekStart as getPeriodStart } from "../lib/time-windows"
import { resolveServer } from "../lib/server-resolve"

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

        // Load settings and compute weekStart per server — different servers may have
        // different configured week-start days or timezones, so we must not assume
        // the first server's settings apply to all.
        const serverSettings = new Map<string, Date>()
        for (const m of members) {
            if (!serverSettings.has(m.server.id)) {
                const srv = await getBotServerSettings(m.server.id)
                serverSettings.set(m.server.id, getPeriodStart(srv.quotaWeekStartDay, srv.quotaTimezone))
            }
        }

        // Aggregate time per-server so each server's week boundary is respected.
        // Shifts are always tied to a serverId, so there is no double-counting.
        const currentTimestamp = Date.now()
        const serverSecondsMap = new Map<string, number>()
        let totalSeconds = 0

        for (const [serverId, weekStart] of serverSettings) {
            // Completed shifts scoped to this server
            const shifts = await prisma.shift.findMany({
                where: {
                    serverId,
                    userId: { in: clerkUserIds },
                    startTime: { gte: weekStart },
                    endTime: { not: null }
                }
            })
            let secs = shifts.reduce((acc: number, sh: any) => acc + (sh.duration || 0), 0)

            // Active shifts: count only time within the current period
            const activeShifts = await prisma.shift.findMany({
                where: {
                    serverId,
                    userId: { in: clerkUserIds },
                    endTime: null
                }
            })
            activeShifts.forEach((sh: any) => {
                const effectiveStart = Math.max(weekStart.getTime(), sh.startTime.getTime())
                secs += Math.floor((currentTimestamp - effectiveStart) / 1000)
            })

            serverSecondsMap.set(serverId, secs)
            totalSeconds += secs
        }

        const totalMinutes = Math.floor(totalSeconds / 60)

        const embed = new EmbedBuilder()
            .setTitle("Weekly Quota Status (Global)")
            .setDescription(`**Total Time This Week:** ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`)
            .setColor(0x3b82f6)

        members.forEach((m: any) => {
            const req = m.role?.quotaMinutes || 0
            if (req === 0) return // Skip if no quota

            // Use this server's scoped time for its own quota check
            const serverMins = Math.floor((serverSecondsMap.get(m.server.id) || 0) / 60)
            const met = serverMins >= req
            const pct = Math.round((serverMins / req) * 100)
            const reqH = Math.floor(req / 60)
            const reqM = req % 60
            const status = met
                ? `✅ ${pct}% (${Math.floor(serverMins / 60)}h ${serverMins % 60}m / ${reqH}h ${reqM}m)`
                : `❌ ${pct}% (${Math.floor(serverMins / 60)}h ${serverMins % 60}m / ${reqH}h ${reqM}m)`

            embed.addFields({
                name: m.server.customName || m.server.name,
                value: status,
                inline: true
            })
        })

        await interaction.editReply({ embeds: [embed] })

    } else if (subcommand === "leaderboard") {
        const discordId = interaction.user.id
        await interaction.deferReply({ ephemeral: true })

        // Resolve the POW server for the guild this command was invoked in.
        // This is the critical scope boundary — every query below must be tied to
        // this serverId so we never leak data across tenants.
        const serverId = await resolveServer(interaction)
        if (!serverId) {
            return interaction.editReply({ content: "This command must be run inside a registered Discord server." })
        }

        // Check permission within this server only
        const invokerMember = await prisma.member.findFirst({
            where: { discordId, serverId },
            include: { role: true }
        })

        const canView = invokerMember && (invokerMember.isAdmin || invokerMember.role?.canViewQuota)
        if (!canView) {
            return interaction.editReply({ content: "You do not have permission to view the quota leaderboard." })
        }

        // Use this server's configured week boundaries
        const s = await getBotServerSettings(serverId)
        const weekStart = getPeriodStart(s.quotaWeekStartDay, s.quotaTimezone)

        // 1. Get all members for this server only
        const members = await prisma.member.findMany({
            where: { serverId },
            include: { role: true, server: true }
        })

        if (members.length === 0) {
            return interaction.editReply({ content: "No members found." })
        }

        const memberList = members
        const memberIds = memberList.map((m: any) => m.userId)

        // 2. Get aggregated time for these users, scoped to this server
        const aggregations = await prisma.shift.groupBy({
            by: ['userId'],
            where: {
                serverId,
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
            where: { serverId, userId: { in: memberIds }, endTime: null },
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
                discordId: m.discordId as string | null,
                robloxUsername: m.robloxUsername as string | null,
                userId: m.userId as string,
                mins,
                quotaMins,
                hasQuota,
                metQuota,
                remaining,
                completionPct
            }
        })

        // Bulk-fetch guild members so we can use display names for users who may have left
        const guild = interaction.guild
        const discordIdsToFetch = leaderboard
            .map(e => e.discordId)
            .filter((id): id is string => !!id)
        const guildMemberNames = new Map<string, string>()
        if (guild && discordIdsToFetch.length > 0) {
            try {
                const fetched = await guild.members.fetch({ user: discordIdsToFetch })
                fetched.forEach((gm: any) => guildMemberNames.set(gm.id, gm.displayName))
            } catch {
                // Non-fatal — fall through to mention/roblox fallbacks
            }
        }

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

            // Prefer guild display name to avoid unresolvable raw mention IDs.
            // Fall back to Roblox username, then a Discord mention, then userId.
            let mention: string
            if (entry.discordId && guildMemberNames.has(entry.discordId)) {
                mention = `**${guildMemberNames.get(entry.discordId)}**`
            } else if (entry.robloxUsername) {
                mention = `**${entry.robloxUsername}**`
            } else if (entry.discordId) {
                mention = `<@${entry.discordId}>`
            } else {
                mention = `\`${entry.userId}\``
            }

            if (!entry.hasQuota) {
                lines.push(`**${i + 1}.** ${mention} - ${timeWorked} *(No quota)*`)
            } else {
                const reqH = Math.floor(entry.quotaMins / 60)
                const reqM = entry.quotaMins % 60
                const quotaStr = `${reqH}h ${reqM}m`
                const pct = Math.round((entry.mins / entry.quotaMins) * 100)

                if (entry.metQuota) {
                    lines.push(`**${i + 1}.** ${mention} - ${timeWorked} / ${quotaStr} ✅ *(${pct}%)*`)
                } else {
                    lines.push(`**${i + 1}.** ${mention} - ${timeWorked} / ${quotaStr} ❌ *(${pct}%)*`)
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
            .setTitle(`Quota Leaderboard`)
            .setDescription(desc)
            .setColor(0xf59e0b) // Amber
            .setFooter({ text: `${memberList.length} members • Week of ${weekStart.toLocaleDateString()}` })

        await interaction.editReply({ embeds: [embed] })
    }
}
