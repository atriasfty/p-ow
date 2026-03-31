import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from "discord.js"
import { prisma } from "../client"
import { resolveServer } from "../lib/server-resolve"
import { findMemberByDiscordId } from "../lib/clerk"

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
