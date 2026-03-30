import { Client, DiscordAPIError, TextChannel } from "discord.js"
import { PrismaClient } from "@prisma/client"
import { getGlobalConfig } from "../lib/config"

export function startAutoRoleSync(client: Client, prisma: PrismaClient) {
    console.log("Starting auto role sync service (dynamic interval)")

    async function schedule() {
        try {
            await syncAllServerRoles(client, prisma)
        } catch (e) {
            console.error("Auto role sync error:", e)
        }
        const interval = await getGlobalConfig("ROLE_SYNC_INTERVAL_MS")
        setTimeout(schedule, interval)
    }

    schedule()
}

async function syncAllServerRoles(client: Client, prisma: PrismaClient) {
    // Get all servers with auto-sync enabled
    const servers = await prisma.server.findMany({
        where: {
            autoSyncRoles: true,
            discordGuildId: { not: null }
        }
    })

    for (const server of servers) {
        if (!server.discordGuildId) continue

        try {
            const guild = await client.guilds.fetch(server.discordGuildId).catch(() => null)
            if (!guild) {
                continue
            }

            // Get all members of this server from DB that have a Discord ID
            const members = await prisma.member.findMany({
                where: {
                    serverId: server.id,
                    discordId: { not: null }
                },
                include: { role: true }
            })

            // Get all active shifts for this server, OR any server in the same guild
            // that shares the same on-duty role.
            const activeShifts = await prisma.shift.findMany({
                where: {
                    endTime: null,
                    OR: [
                        { serverId: server.id },
                        ...(server.onDutyRoleId ? [{
                            server: {
                                discordGuildId: server.discordGuildId,
                                onDutyRoleId: server.onDutyRoleId
                            }
                        }] : [])
                    ]
                }
            })
            const activeShiftUserIds = new Set(activeShifts.map((s: any) => s.userId))

            // Get all active, approved LOAs for this server
            const now = new Date()
            const activeLoas = await prisma.leaveOfAbsence.findMany({
                where: {
                    serverId: server.id,
                    status: "approved",
                    startDate: { lte: now },
                    endDate: { gte: now }
                }
            })
            const activeLoaUserIds = new Set(activeLoas.map((l: any) => l.userId))

            // Get all milestones for this server
            const milestones = await prisma.staffMilestone.findMany({
                where: { serverId: server.id }
            })

            // Calculate current week start (Monday)
            const day = now.getDay()
            const diff = now.getDate() - day + (day === 0 ? -6 : 1)
            const weekStart = new Date(now)
            weekStart.setDate(diff)
            weekStart.setHours(0, 0, 0, 0)

            // Calculate weekly duty time for all members
            const shiftAggregates = await prisma.shift.groupBy({
                by: ['userId'],
                where: {
                    serverId: server.id,
                    endTime: { not: null },
                    startTime: { gte: weekStart }
                },
                _sum: {
                    duration: true
                }
            })
            const userTotalMinutes = new Map(shiftAggregates.map((a: any) => [
                a.userId,
                Math.floor((a._sum.duration || 0) / 60)
            ]))

            // Track if we've already alerted for this server in this sync cycle
            let hasAlertedForPermissions = false

            // Process each member
            for (const member of members) {
                if (!member.discordId) continue

                try {
                    // Use cache if possible, otherwise fetch
                    const guildMember = guild.members.cache.get(member.discordId) ||
                        await guild.members.fetch(member.discordId).catch(() => null)

                    if (!guildMember) continue

                    // Handle on-duty role
                    if (server.onDutyRoleId) {
                        const isOnDuty = activeShiftUserIds.has(member.discordId) || activeShiftUserIds.has(member.userId)
                        const hasRole = guildMember.roles.cache.has(server.onDutyRoleId)

                        if (isOnDuty && !hasRole) {
                            await guildMember.roles.add(server.onDutyRoleId)
                        } else if (!isOnDuty && hasRole) {
                            await guildMember.roles.remove(server.onDutyRoleId)
                        }
                    }

                    // Handle On-LOA role
                    if (server.onLoaRoleId) {
                        const isOnLoa = activeLoaUserIds.has(member.discordId) || activeLoaUserIds.has(member.userId)
                        const hasRole = guildMember.roles.cache.has(server.onLoaRoleId)

                        if (isOnLoa && !hasRole) {
                            await guildMember.roles.add(server.onLoaRoleId)
                        } else if (!isOnLoa && hasRole) {
                            await guildMember.roles.remove(server.onLoaRoleId)
                        }
                    }

                    // Handle Milestones
                    if (milestones.length > 0) {
                        const totalMinutes = userTotalMinutes.get(member.userId) || 0
                        for (const milestone of milestones) {
                            if (!milestone.rewardRoleId) continue

                            const reached = totalMinutes >= milestone.requiredMinutes
                            const hasRole = guildMember.roles.cache.has(milestone.rewardRoleId)

                            if (reached && !hasRole) {
                                await guildMember.roles.add(milestone.rewardRoleId)
                            }
                            // Note: We don't remove milestone roles if they drop below (shouldn't happen anyway)
                        }
                    }
                } catch (memberError: any) {
                    // Alert on missing permissions (role hierarchy or bot permissions)
                    if (memberError instanceof DiscordAPIError && memberError.code === 50013) {
                        console.error(`[ROLE-SYNC] Missing permissions to update roles in ${guild.name}`)

                        if (!hasAlertedForPermissions) {
                            const alertChannelId = server.permLogChannelId || guild.systemChannelId
                            if (alertChannelId) {
                                try {
                                    const channel = await guild.channels.fetch(alertChannelId).catch(() => null)
                                    if (channel instanceof TextChannel) {
                                        await channel.send(`⚠️ **Role Sync Failure:** The bot lacks permissions to update roles in this server. Please ensure the bot's role is positioned **above** the on-duty roles in the server settings.`)
                                    }
                                } catch (e) { }
                            }
                            hasAlertedForPermissions = true
                        }
                    }
                }

                // Small sleep to prevent hammering Discord Gateway in tight loops
                await new Promise(r => setTimeout(r, 100))
            }
        } catch (serverError: any) {
            console.error(`Error syncing server ${server.name}:`, serverError.message || serverError)
        }
    }
}
