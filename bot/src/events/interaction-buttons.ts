import { ButtonInteraction, ModalSubmitInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, TextChannel } from "discord.js"
import { prisma } from "../client"

// ---- Entry points ----

export async function handleButtonInteraction(interaction: ButtonInteraction) {
    const [action, ...rest] = interaction.customId.split(":")
    const data = rest.join(":")

    if (action === "loa_accept" || action === "loa_deny") {
        await handleLoaAction(interaction, action === "loa_accept", data)
        return
    }

    if (action === "form_accept" || action === "form_deny") {
        await handleFormApplicationButton(interaction, action === "form_accept", data)
        return
    }
}

export async function handleModalSubmitInteraction(interaction: ModalSubmitInteraction) {
    const [action, ...rest] = interaction.customId.split(":")

    if (action === "form_accept_modal" || action === "form_deny_modal") {
        const [responseId, channelId, messageId] = rest
        await handleFormApplicationModal(interaction, action === "form_accept_modal", responseId, channelId, messageId)
        return
    }
}

// ---- Form application ----

async function handleFormApplicationButton(interaction: ButtonInteraction, accepted: boolean, responseId: string) {
    // Encode the original message location in the modal custom_id so the modal
    // submit handler can edit it to remove the buttons after a decision.
    const modalCustomId = `${accepted ? "form_accept_modal" : "form_deny_modal"}:${responseId}:${interaction.channelId}:${interaction.message.id}`

    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle(accepted ? "Accept Application" : "Deny Application")

    const reasonInput = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel(accepted ? "Reason (optional)" : "Reason for denial")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(!accepted)
        .setMaxLength(500)
        .setPlaceholder(accepted ? "e.g. Great application, welcome aboard!" : "e.g. Insufficient experience at this time.")

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput))
    await interaction.showModal(modal)
}

async function handleFormApplicationModal(
    interaction: ModalSubmitInteraction,
    accepted: boolean,
    responseId: string,
    channelId: string,
    messageId: string
) {
    await interaction.deferReply({ ephemeral: true })

    try {
        const reason = interaction.fields.getTextInputValue("reason").trim() ||
            (accepted ? "No reason provided." : "No reason given.")

        // Fetch FormResponse and Form via raw SQL — these models exist in the shared
        // DB (created by dashboard migrations) but are not in the bot's Prisma schema.
        const responseRows = await prisma.$queryRaw<{ id: string, formId: string, respondentId: string | null, status: string }[]>`
            SELECT id, formId, respondentId, status FROM FormResponse WHERE id = ${responseId} LIMIT 1
        `
        const responseRow = responseRows[0]
        if (!responseRow) {
            await interaction.editReply({ content: "Application response not found." })
            return
        }

        if (responseRow.status === "accepted" || responseRow.status === "denied") {
            await interaction.editReply({ content: "This application has already been reviewed." })
            return
        }

        const formRows = await prisma.$queryRaw<{ id: string, serverId: string, title: string, acceptedRoleId: string | null, congratsChannelId: string | null }[]>`
            SELECT id, serverId, title, acceptedRoleId, congratsChannelId FROM Form WHERE id = ${responseRow.formId} LIMIT 1
        `
        const formRow = formRows[0]
        if (!formRow) {
            await interaction.editReply({ content: "Form not found." })
            return
        }

        // Update the response status
        const newStatus = accepted ? "accepted" : "denied"
        await prisma.$executeRaw`UPDATE FormResponse SET status = ${newStatus} WHERE id = ${responseId}`

        // Look up the member for their display name and Discord ID
        const member = await prisma.member.findFirst({
            where: { userId: responseRow.respondentId ?? "", serverId: formRow.serverId },
            select: { discordId: true, robloxUsername: true }
        })

        const displayName = member?.robloxUsername ?? responseRow.respondentId ?? "Unknown"
        const discordMention = member?.discordId ? `<@${member.discordId}>` : displayName

        // Edit the original recruitment message — remove buttons, stamp the decision
        try {
            const channel = await interaction.client.channels.fetch(channelId).catch(() => null)
            if (channel?.isTextBased()) {
                const originalMessage = await (channel as TextChannel).messages.fetch(messageId).catch(() => null)
                if (originalMessage) {
                    const originalEmbed = originalMessage.embeds[0]?.toJSON() ?? {}
                    const updatedEmbed = {
                        ...originalEmbed,
                        title: accepted ? "✅ Application Accepted" : "❌ Application Denied",
                        color: accepted ? 0x10b981 : 0xef4444,
                        fields: [
                            ...(originalEmbed.fields ?? []),
                            { name: "Decision By", value: `<@${interaction.user.id}>`, inline: true },
                            { name: "Reason", value: reason, inline: false }
                        ]
                    }
                    await originalMessage.edit({ embeds: [updatedEmbed], components: [] })
                }
            }
        } catch (e) {
            console.error("[FORM-BUTTON] Failed to edit original message:", e)
        }

        // Grant Discord role if accepted and configured
        if (accepted && formRow.acceptedRoleId && member?.discordId) {
            await prisma.botQueue.create({
                data: {
                    serverId: formRow.serverId,
                    type: "ROLE_ADD",
                    targetId: member.discordId,
                    content: formRow.acceptedRoleId
                }
            })
        }

        // Send result embed to congrats channel for both accept and deny
        if (formRow.congratsChannelId) {
            const resultMessage = {
                embeds: [{
                    title: accepted ? "🎉 Application Accepted" : "❌ Application Denied",
                    description: `${discordMention}'s application for **${formRow.title}** has been **${accepted ? "accepted" : "denied"}**.`,
                    color: accepted ? 0x10b981 : 0xef4444,
                    fields: [
                        { name: "Reason", value: reason, inline: false },
                        { name: "Reviewed By", value: `<@${interaction.user.id}>`, inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }]
            }

            await prisma.botQueue.create({
                data: {
                    serverId: formRow.serverId,
                    type: "MESSAGE",
                    targetId: formRow.congratsChannelId,
                    content: JSON.stringify(resultMessage)
                }
            })
        }

        await interaction.editReply({
            content: accepted
                ? `✅ Application accepted. ${member?.discordId ? `<@${member.discordId}>` : displayName} will be notified in <#${formRow.congratsChannelId ?? "the congrats channel"}>.`
                : `❌ Application denied. Result posted${formRow.congratsChannelId ? ` in <#${formRow.congratsChannelId}>` : ""}.`
        })
    } catch (e) {
        console.error("[FORM-MODAL] Error:", e)
        await interaction.editReply({ content: "Something went wrong processing this application." })
    }
}

// ---- LOA ----

async function handleLoaAction(interaction: ButtonInteraction, approved: boolean, loaId: string) {
    try {
        await interaction.deferUpdate()

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

        const embed = interaction.message.embeds[0].toJSON()
        embed.title = approved ? "✅ LOA Request Approved" : "❌ LOA Request Declined"
        embed.color = approved ? 0x10b981 : 0xef4444

        embed.fields?.push({
            name: "Decision By",
            value: `<@${interaction.user.id}>`,
            inline: true
        })

        await interaction.editReply({
            embeds: [embed],
            components: []
        })

        if (approved && loa.server.onLoaRoleId) {
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
                    await guildMember.roles.add(loa.server.onLoaRoleId).catch(() => { })
                }
            }
        }

        const user = await interaction.client.users.fetch(loa.userId).catch(() => null)
        if (user) {
            await user.send({
                embeds: [{
                    title: `LOA Request ${approved ? "Approved" : "Declined"}`,
                    description: `Your Leave of Absence request for **${loa.server.customName || loa.server.name}** has been ${status}.`,
                    color: approved ? 0x10b981 : 0xef4444,
                    fields: [
                        { name: "Reason", value: loa.reason },
                        { name: "Start Date", value: loa.startDate.toLocaleDateString(), inline: true },
                        { name: "End Date", value: loa.endDate.toLocaleDateString(), inline: true }
                    ]
                }]
            }).catch(() => { })
        }
    } catch (e) {
        console.error("[LOA-BUTTON] Error:", e)
    }
}
