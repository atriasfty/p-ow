import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from "discord.js"
import { prisma } from "../client"
import { resolveServer } from "../lib/server-resolve"
import { findMemberByDiscordId } from "../lib/clerk"
import { PrcClient } from "../lib/prc"

export async function handleShiftCommand(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand()
    const discordId = interaction.user.id

    // ALWAYS defer first to avoid timeout (Clerk lookup can take time)
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] })

    if (subcommand === "start") {
        const serverId = await resolveServer(interaction)
        if (!serverId) return interaction.editReply({ content: "❌ You must specify a server or run this within a registered Guild." })

        // Find member using Clerk lookup
        const member = await findMemberByDiscordId(prisma, discordId, serverId)

        if (!member) {
            return interaction.editReply({
                content: "You are not a member of this server. Please make sure you're registered in the dashboard."
            })
        }

        if (!member.role || !member.role.canShift) {
            return interaction.editReply({ content: "You do not have permission to go on shift on this server." })
        }

        // Check if already on shift
        const activeShift = await prisma.shift.findFirst({
            where: { userId: member.userId, serverId, endTime: null }
        })

        if (activeShift) {
            return interaction.editReply({ content: "You are already on shift on this server!" })
        }

        // Check if server has players before allowing shift start
        if (!member.server.apiUrl) {
            return interaction.editReply({ content: "❌ Server not configured properly." })
        }

        try {
            const prcClient = new PrcClient(member.server.apiUrl)
            const players = await prcClient.getPlayers()
            if (players.length === 0) {
                return interaction.editReply({ content: "❌ Cannot go on duty - server has no players." })
            }
        } catch (apiError) {
            return interaction.editReply({ content: "❌ Cannot go on duty - server appears to be offline." })
        }

        // Start shift
        await prisma.shift.create({
            data: {
                userId: member.userId,
                serverId,
                startTime: new Date()
            }
        })

        // Add Discord Role if configured
        if (member.server.onDutyRoleId && interaction.guild) {
            try {
                const guildMember = await interaction.guild.members.fetch(discordId)
                await guildMember.roles.add(member.server.onDutyRoleId)
            } catch (e: any) {
                // Non-critical: role add failed
            }
        }

        const embed = new EmbedBuilder()
            .setTitle("Shift Started")
            .setDescription(`You are now on duty on **${member.server.customName || member.server.name}**.`)
            .setColor(0x10b981)
            .setTimestamp()

        await interaction.editReply({ embeds: [embed] })

    } else if (subcommand === "end") {
        const serverId = await resolveServer(interaction)
        if (!serverId) return interaction.editReply({ content: "❌ You must specify a server or run this within a registered Guild." })

        // Find member using Clerk lookup
        const member = await findMemberByDiscordId(prisma, discordId, serverId)

        if (!member) {
            return interaction.editReply({ content: "You are not a member of this server." })
        }

        const activeShift = await prisma.shift.findFirst({
            where: { userId: member.userId, serverId, endTime: null },
            include: { server: true }
        })

        if (!activeShift) {
            return interaction.editReply({ content: "You are not currently on shift on this server." })
        }

        const now = new Date()
        const duration = Math.floor((now.getTime() - activeShift.startTime.getTime()) / 1000)

        await prisma.shift.update({
            where: { id: activeShift.id },
            data: {
                endTime: now,
                duration
            }
        })

        // Check for milestones
        const { processMilestones } = await import("../lib/milestones")
        await processMilestones(member.userId, serverId)

        // Remove Discord Role if configured
        if (activeShift.server.onDutyRoleId && interaction.guild) {
            try {
                const guildMember = await interaction.guild.members.fetch(discordId)
                await guildMember.roles.remove(activeShift.server.onDutyRoleId)
            } catch (e) {
                // Non-critical: role remove failed
            }
        }

        const hours = Math.floor(duration / 3600)
        const minutes = Math.floor((duration % 3600) / 60)
        const seconds = duration % 60

        const embed = new EmbedBuilder()
            .setTitle("Shift Ended")
            .setDescription(`You went off duty on **${activeShift.server.customName || activeShift.server.name}**.`)
            .addFields({ name: "Duration", value: `${hours}h ${minutes}m ${seconds}s` })
            .setColor(0xef4444)
            .setTimestamp()

        await interaction.editReply({ embeds: [embed] })

    } else if (subcommand === "status") {
        // OPTIMIZATION: Use a single query for all active user shifts across servers
        // We first need to find all Member entries for this Discord ID to get their Clerk UserIDs
        const members = await prisma.member.findMany({
            where: { discordId }
        })

        if (members.length === 0) {
            return interaction.editReply({ content: "You are currently **OFF DUTY** on all servers." })
        }

        const clerkUserIds = Array.from(new Set(members.map((m: any) => m.userId)))

        const userShifts = await prisma.shift.findMany({
            where: {
                userId: { in: clerkUserIds },
                endTime: null
            },
            include: { server: true }
        })

        if (userShifts.length === 0) {
            return interaction.editReply({ content: "You are currently **OFF DUTY** on all servers." })
        }

        const embed = new EmbedBuilder()
            .setTitle("Current Shift Status")
            .setColor(0x3b82f6)

        userShifts.forEach((s: any) => {
            const duration = Math.floor((Date.now() - s.startTime.getTime()) / 1000)
            const h = Math.floor(duration / 3600)
            const m = Math.floor((duration % 3600) / 60)
            embed.addFields({
                name: s.server.customName || s.server.name,
                value: `Active for ${h}h ${m}m\nStarted: <t:${Math.floor(s.startTime.getTime() / 1000)}:R>`
            })
        })

        await interaction.editReply({ embeds: [embed] })
    }
}
