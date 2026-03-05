import { ButtonInteraction } from "discord.js"
import { prisma } from "../client"

export async function handleButtonInteraction(interaction: ButtonInteraction) {
    const [action, data] = interaction.customId.split(":")

    if (action === "loa_accept" || action === "loa_deny") {
        await handleLoaAction(interaction, action === "loa_accept", data)
    }
}

async function handleLoaAction(interaction: ButtonInteraction, approved: boolean, loaId: string) {
    try {
        await interaction.deferUpdate()

        // 1. Update DB
        const status = approved ? "approved" : "declined"
        const loa = await prisma.leaveOfAbsence.update({
            where: { id: loaId },
            data: { 
                status,
                reviewedBy: interaction.user.id,
                reviewedAt: new Date()
            },
            include: { server: true }
        })

        // 2. Update Embed
        const embed = interaction.message.embeds[0].toJSON()
        embed.title = approved ? "✅ LOA Request Approved" : "❌ LOA Request Declined"
        embed.color = approved ? 0x10b981 : 0xef4444 // Emerald vs Red
        
        embed.fields?.push({
            name: "Decision By",
            value: `<@${interaction.user.id}>`,
            inline: true
        })

        // 3. Remove buttons
        await interaction.editReply({
            embeds: [embed],
            components: []
        })

        // 4. Role Management (if approved)
        if (approved && loa.server.onLoaRoleId) {
            // Find member using Clerk ID (userId) or Discord ID
            const member = await prisma.member.findFirst({
                where: {
                    serverId: loa.serverId,
                    OR: [
                        { userId: loa.userId },
                        { discordId: loa.userId }
                    ]
                }
            })

            const discordId = member?.discordId || (loa.userId.startsWith("user_") ? null : loa.userId)

            if (discordId) {
                const guild = await interaction.client.guilds.fetch(loa.server.discordGuildId!).catch(() => null)
                const guildMember = await guild?.members.fetch(discordId).catch(() => null)
                
                if (guildMember && loa.server.onLoaRoleId) {
                    await guildMember.roles.add(loa.server.onLoaRoleId).catch(() => {})
                }
            }
        }

        // 5. Notify User (DM)
        const user = await interaction.client.users.fetch(loa.userId).catch(() => null)
        if (user) {
            await user.send({
                embeds: [{
                    title: `LOA Request ${approved ? 'Approved' : 'Declined'}`,
                    description: `Your Leave of Absence request for **${loa.server.customName || loa.server.name}** has been ${status}.`,
                    color: approved ? 0x10b981 : 0xef4444,
                    fields: [
                        { name: "Reason", value: loa.reason },
                        { name: "Start Date", value: loa.startDate.toLocaleDateString(), inline: true },
                        { name: "End Date", value: loa.endDate.toLocaleDateString(), inline: true }
                    ]
                }]
            }).catch(() => {})
        }

    } catch (e) {
        console.error("[LOA-BUTTON] Error:", e)
    }
}
