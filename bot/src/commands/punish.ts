import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js"
import { prisma } from "../client"
import { resolveServer } from "../lib/server-resolve"
import { findMemberByDiscordId } from "../lib/clerk"
import { getRobloxId } from "../lib/roblox"

export async function handlePunishCommand(interaction: ChatInputCommandInteraction) {
    if (interaction.commandName !== "log") return

    const subcommand = interaction.options.getSubcommand()

    if (subcommand === "punishment") {
        await handleLogPunishment(interaction)
    } else if (subcommand === "view") {
        await handleLogView(interaction)
    }
}

async function handleLogPunishment(interaction: ChatInputCommandInteraction) {
    // Defer immediately
    await interaction.deferReply({ ephemeral: true })

    const serverId = await resolveServer(interaction)
    if (!serverId) return interaction.editReply({ content: "❌ You must specify a server or run this within a registered Guild." })
    const username = interaction.options.getString("username", true)
    const type = interaction.options.getString("type", true)
    const reason = interaction.options.getString("reason", true)
    const discordId = interaction.user.id

    // Find member using Clerk
    const member = await findMemberByDiscordId(prisma, discordId, serverId)

    if (!member) {
        return interaction.editReply({ content: "You do not have access to this server." })
    }

    if (!member.role) {
        return interaction.editReply({ content: "You do not have a role assigned on this server." })
    }

    // Check permissions
    if (type === "Warn" && !member.role.canIssueWarnings) return interaction.editReply({ content: "You do not have permission to issue warnings." })
    if (type === "Kick" && !member.role.canKick) return interaction.editReply({ content: "You do not have permission to issue kicks." })
    if (type === "Ban" && !member.role.canBan) return interaction.editReply({ content: "You do not have permission to issue bans." })
    if (type === "Ban Bolo" && !member.role.canBanBolo) return interaction.editReply({ content: "You do not have permission to issue Ban Bolos." })

    // Resolve Roblox Username to ID
    const userId = await getRobloxId(username)
    if (!userId) {
        return interaction.editReply("Could not find a Roblox user with that username.")
    }

    // Create Punishment - use member.userId (Roblox ID) as moderatorId for consistency
    await prisma.punishment.create({
        data: {
            serverId,
            userId,
            moderatorId: member.userId, // Use Roblox ID from Member table, NOT Discord ID
            type,
            reason,
            resolved: false
        }
    })

    const embed = new EmbedBuilder()
        .setTitle("Punishment Logged")
        .setDescription(`Logged ${type} for **${username}**.`)
        .addFields(
            { name: "Reason", value: reason },
            { name: "Server", value: member.server.customName || member.server.name }
        )
        .setColor(0xef4444)
        .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
}

async function handleLogView(interaction: ChatInputCommandInteraction) {
    // Defer immediately
    await interaction.deferReply({ ephemeral: true })

    const serverId = await resolveServer(interaction)
    if (!serverId) return interaction.editReply({ content: "❌ You must specify a server or run this within a registered Guild." })
    const username = interaction.options.getString("username", true)
    const logType = interaction.options.getString("type", true)
    const discordId = interaction.user.id

    // Find member using Clerk (verify access)
    const member = await findMemberByDiscordId(prisma, discordId, serverId)

    if (!member) {
        return interaction.editReply({ content: "You do not have access to this server." })
    }

    if (!member.role) {
        return interaction.editReply({ content: "You do not have a role assigned on this server." })
    }

    if (logType === "punishment" && !member.role.canViewPunishments) {
        return interaction.editReply({ content: "You do not have permission to view punishments." })
    } else if (logType !== "punishment" && logType !== "all" && !member.role.canViewLogs) {
        return interaction.editReply({ content: "You do not have permission to view connection/command/kill logs." })
    } else if (logType === "all" && (!member.role.canViewPunishments || !member.role.canViewLogs)) {
        return interaction.editReply({ content: "You need permission to view both punishments and logs to use the 'all' option." })
    }

    // Resolve Roblox Username to ID
    const userId = await getRobloxId(username)
    if (!userId) {
        return interaction.editReply("Could not find a Roblox user with that username.")
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const logLines: string[] = []

    // Handle punishment type separately
    if (logType === "punishment") {
        const punishments = await prisma.punishment.findMany({
            where: {
                serverId,
                userId
            },
            orderBy: { createdAt: "desc" },
            take: 25
        })

        if (punishments.length === 0) {
            return interaction.editReply(`No punishments found for **${username}**.`)
        }

        for (const p of punishments) {
            const time = `<t:${Math.floor(p.createdAt.getTime() / 1000)}:R>`
            const icon = p.type === "Ban" ? "🔨" : p.type === "Kick" ? "👢" : p.type === "Ban Bolo" ? "🚨" : "⚠️"
            const reasonText = p.reason || "No reason"
            const reason = reasonText.length > 40 ? reasonText.substring(0, 37) + "..." : reasonText
            logLines.push(`${time} ${icon} **${p.type}** - ${reason}`)
        }

        const embed = new EmbedBuilder()
            .setTitle(`⚖️ Punishments for ${username}`)
            .setDescription(logLines.join("\n"))
            .setColor(0xef4444)
            .setFooter({ text: `Showing ${punishments.length} punishments • Server: ${member.server.customName || member.server.name}` })
            .setTimestamp()

        return interaction.editReply({ embeds: [embed] })
    }

    // Build log query based on type
    const logWhere: any = {
        serverId,
        createdAt: { gte: oneWeekAgo },
        OR: [
            { playerId: userId },
            { killerId: userId },
            { victimId: userId }
        ]
    }

    // Filter by type if not "all"
    if (logType !== "all") {
        logWhere.type = logType
    }

    const logs = await prisma.log.findMany({
        where: logWhere,
        orderBy: { createdAt: "desc" },
        take: 25
    })

    if (logs.length === 0) {
        return interaction.editReply(`No ${logType === "all" ? "logs" : logType + " logs"} found for **${username}** in the last 7 days.`)
    }

    // Format logs into embed
    for (const log of logs) {
        const time = `<t:${Math.floor(log.createdAt.getTime() / 1000)}:R>`

        if (log.type === "join") {
            const action = log.isJoin ? "🟢 Joined" : "🔴 Left"
            logLines.push(`${time} ${action}`)
        } else if (log.type === "kill") {
            if (log.killerId === userId) {
                logLines.push(`${time} ⚔️ Killed **${log.victimName || "Unknown"}**`)
            } else {
                logLines.push(`${time} 💀 Killed by **${log.killerName || "Unknown"}**`)
            }
        } else if (log.type === "command" && log.command) {
            const cmd = log.command.length > 50 ? log.command.substring(0, 47) + "..." : log.command
            logLines.push(`${time} 🔧 \`${cmd}\``)
        }
    }

    const typeLabel = logType === "all" ? "Logs" : logType.charAt(0).toUpperCase() + logType.slice(1) + " Logs"
    const embed = new EmbedBuilder()
        .setTitle(`📜 ${typeLabel} for ${username}`)
        .setDescription(logLines.join("\n") || "No logs found")
        .setColor(0x6366f1)
        .setFooter({ text: `Showing last ${logs.length} entries (7 days) • Server: ${member.server.customName || member.server.name}` })
        .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
}
