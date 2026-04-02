import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from "discord.js"
import { prisma } from "../client"
import { resolveServer } from "../lib/server-resolve"
import { PrcClient } from "../lib/prc"
import { findMemberByDiscordId, getRobloxUsername } from "../lib/clerk"

export async function handleIngameCommand(interaction: ChatInputCommandInteraction) {
    const serverId = await resolveServer(interaction)
    if (!serverId) return interaction.editReply({ content: "❌ You must specify a server or run this within a registered Guild." })
    const cmd = interaction.options.getString("cmd", true)
    const discordId = interaction.user.id

    // Defer immediately before Clerk lookup
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] })

    // Find member using Clerk
    const member = await findMemberByDiscordId(prisma, discordId, serverId)

    if (!member) {
        return interaction.editReply({ content: "You are not a member of this server." })
    }

    // Check permissions - require canUseToolbox permission
    if (!member.role) {
        return interaction.editReply({
            content: `You do not have a role assigned on this server.\n\n**Debug Info:**\n- Member ID: \`${member.id}\`\n- User ID: \`${member.userId}\`\n- Role ID: \`${member.roleId || 'null'}\`\n\nPlease ask an admin to assign you a role in the dashboard.`
        })
    }

    if (!member.role.canUseToolbox) {
        return interaction.editReply({ content: `Your role (${member.role.name}) does not have the 'Can Use Toolbox' permission enabled.` })
    }

    // Restricted commands check
    const restrictedPrefixes = [":mod", ":unmod", ":admin", ":unadmin"]
    const lowerCommand = cmd.toLowerCase().trim()
    const isRestricted = restrictedPrefixes.some(p => lowerCommand.startsWith(p))

    if (isRestricted && !member.role.canUseAdminCommands) {
        return interaction.editReply({
            content: "You do not have permission to use admin commands (:mod, :admin, etc.)"
        })
    }

    try {
        const client = new PrcClient(member.server.apiUrl)
        await client.executeCommand(cmd)

        // Log to Discord if a channel is configured
        if (member.server.commandLogChannelId) {
            try {
                const logChannel = await interaction.client.channels.fetch(member.server.commandLogChannelId)
                if (logChannel && logChannel.isTextBased()) {
                    const moderatorName = getRobloxUsername(member, interaction.user.username)
                    await (logChannel as any).send({
                        content: `**[Command Log - Discord]** \`${moderatorName}\` ran: \`${cmd}\``
                    })
                }
            } catch (e) {
                // Non-critical: logging failed
            }
        }

        await interaction.editReply({
            content: `Executed command on **${member.server.customName || member.server.name}**: \`${cmd}\``
        })

    } catch (e: any) {
        await interaction.editReply({ content: `Failed to execute command: ${e.message}` })
    }
}
