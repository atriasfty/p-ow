import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from "discord.js"
import { prisma } from "../client"
import { resolveServer } from "../lib/server-resolve"
import { findMemberByDiscordId } from "../lib/clerk"
import { getBotServerSettings } from "../lib/server-settings"

export async function handleLoaCommand(interaction: ChatInputCommandInteraction) {
    if (interaction.options.getSubcommand() === "request") {
        const serverId = await resolveServer(interaction)
        if (!serverId) {
            return interaction.reply({ content: "❌ This command must be run within a registered Project Overwatch server.", flags: [MessageFlags.Ephemeral] })
        }

        const startDateStr = interaction.options.getString("start_date", true)
        const endDateStr = interaction.options.getString("end_date", true)
        const reason = interaction.options.getString("reason", true)
        const discordId = interaction.user.id

        // Validate dates first (quick check)
        const startDate = new Date(startDateStr)
        const endDate = new Date(endDateStr)

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return interaction.reply({ content: "Invalid date format. Use YYYY-MM-DD", flags: [MessageFlags.Ephemeral] })
        }

        if (endDate < startDate) {
            return interaction.reply({ content: "End date cannot be before start date", flags: [MessageFlags.Ephemeral] })
        }

        // Defer ASAP before Clerk lookup
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] })

        const member = await findMemberByDiscordId(prisma, discordId, serverId)

        if (!member) {
            return interaction.editReply("You are not a member of this server.")
        }

        if (!member.role || !member.role.canRequestLoa) {
            return interaction.editReply("You do not have permission to request an LOA on this server.")
        }

        // Load server settings to enforce per-server rules
        const s = await getBotServerSettings(serverId)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Validate max duration
        if (s.loaMaxDurationDays > 0) {
            const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
            if (durationDays > s.loaMaxDurationDays) {
                return interaction.editReply(`❌ LOA duration cannot exceed ${s.loaMaxDurationDays} days.`)
            }
        }

        // Validate minimum notice
        if (s.loaMinNoticeDays > 0) {
            const noticeDays = Math.ceil((startDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
            if (noticeDays < s.loaMinNoticeDays) {
                return interaction.editReply(`❌ LOA must be submitted at least ${s.loaMinNoticeDays} day(s) in advance.`)
            }
        }

        // Validate max pending per member
        if (s.loaMaxPendingPerMember > 0) {
            const pendingCount = await prisma.leaveOfAbsence.count({
                where: { serverId, userId: member.userId, status: "pending" }
            })
            if (pendingCount >= s.loaMaxPendingPerMember) {
                return interaction.editReply(`❌ You already have ${pendingCount} pending LOA request(s) (max ${s.loaMaxPendingPerMember}).`)
            }
        }

        // Create LOA
        await prisma.leaveOfAbsence.create({
            data: {
                userId: member.userId,
                serverId: member.server.id,
                startDate,
                endDate,
                reason,
                status: "pending"
            }
        })

        const embed = new EmbedBuilder()
            .setTitle("LOA Request Submitted")
            .setDescription(`Successfully requested LOA for **${member.server.customName || member.server.name}**. Admins will review it shortly.`)
            .addFields(
                { name: "Start Date", value: startDate.toLocaleDateString(), inline: true },
                { name: "End Date", value: endDate.toLocaleDateString(), inline: true },
                { name: "Reason", value: reason }
            )
            .setColor(0x10b981)

        await interaction.editReply({ embeds: [embed] })
    }
}
