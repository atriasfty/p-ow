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

    // Strict command gate. The previous block-list ([":mod", ":unmod",
    // ":admin", ":unadmin"]) let canUseToolbox staff run :kick / :ban /
    // :shutdown / :restart / :tp / :setrank — bypassing the formal punishment
    // system and the server-owner safeguards entirely. We now require explicit
    // permission per command class and reject anything we don't recognise.
    const lowerCommand = cmd.toLowerCase().trim()
    const firstToken = lowerCommand.split(/\s+/)[0]

    if (!firstToken.startsWith(":")) {
        return interaction.editReply({
            content: "Only commands starting with ':' are allowed via this tool."
        })
    }

    // Commands that only require canUseToolbox. Everything else needs
    // canUseAdminCommands explicitly.
    const TOOLBOX_OK = new Set([
        ":pm", ":m", ":h", ":msg", ":announce", ":log", ":time", ":weather"
    ])
    // Punishment commands. Routed through the dashboard's formal /punishments
    // API so they get audit-logged. Block them here.
    const PUNISH_BLOCKED = new Set([":kick", ":ban", ":unban", ":warn"])
    // Operational / destructive — must be admin.
    const ADMIN_ONLY = new Set([
        ":mod", ":unmod", ":admin", ":unadmin",
        ":shutdown", ":restart", ":reset",
        ":tp", ":teleport", ":bring", ":to",
        ":setrank", ":rank",
        ":kill", ":respawn", ":heal",
        ":god", ":ungod",
        ":givecash", ":refund",
        ":unjail", ":jail"
    ])

    if (PUNISH_BLOCKED.has(firstToken)) {
        return interaction.editReply({
            content: `\`${firstToken}\` is a punishment command — use the dashboard Player Panel so it is logged and reversible.`
        })
    }

    const needsAdmin = ADMIN_ONLY.has(firstToken) || !TOOLBOX_OK.has(firstToken)
    if (needsAdmin && !member.role.canUseAdminCommands) {
        return interaction.editReply({
            content: `Your role (${member.role.name}) does not have permission to run \`${firstToken}\` via this tool. Ask a server owner if you need elevated commands.`
        })
    }

    try {
        const client = new PrcClient(member.server.apiUrl)
        await client.executeCommand(cmd)

        // Log to Discord if a channel is configured.
        // Strip Discord markdown/mention chars from user-controlled strings to prevent
        // @everyone pings, embed injection, or code-span breakout via backticks.
        if (member.server.commandLogChannelId) {
            try {
                const logChannel = await interaction.client.channels.fetch(member.server.commandLogChannelId)
                if (logChannel && logChannel.isTextBased()) {
                    const stripDiscord = (s: string) => s.replace(/[`*_~|@#<>[\]]/g, "").slice(0, 100)
                    const moderatorName = stripDiscord(getRobloxUsername(member, interaction.user.username))
                    const safeCommand = cmd.replace(/`/g, "'").slice(0, 500)
                    await (logChannel as any).send({
                        content: `**[Command Log - Discord]** \`${moderatorName}\` ran: \`${safeCommand}\``
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
