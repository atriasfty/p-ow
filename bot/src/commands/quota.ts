import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js"
import { prisma } from "../client"

export async function handleQuotaCommand(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand()

    // Get week start (Monday) in a timezone-independent way (UTC)
    const now = new Date()
    const day = now.getUTCDay()
    // Calculate days to subtract to get to last Monday
    // getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat
    // If today is Monday(1), diff is 0. If Sunday(0), diff is -6.
    const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1)

    const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff, 0, 0, 0, 0))

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

        // Get Global Time across all possible user IDs
        const shifts = await prisma.shift.findMany({
            where: {
                userId: { in: clerkUserIds },
                startTime: { gte: weekStart },
                endTime: { not: null }
            }
        })

        const activeShifts = await prisma.shift.findMany({
            where: {
                userId: { in: clerkUserIds },
                endTime: null,
                startTime: { gte: weekStart }
            }
        })

        // Calc total seconds from completed shifts
        let totalSeconds = shifts.reduce((acc: number, s: any) => acc + (s.duration || 0), 0)

        // Add active shifts current duration
        const currentTimestamp = Date.now()
        activeShifts.forEach((s: any) => {
            totalSeconds += Math.floor((currentTimestamp - s.startTime.getTime()) / 1000)
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
