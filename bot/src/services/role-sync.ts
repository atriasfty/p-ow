import { Client } from "discord.js"
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
            // that shares the same on-duty role. This prevents flickering roles
            // for members of multiple servers in the same community.
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
                            await guildMember.roles.add(server.onDutyRoleId).catch(() => {})
                        } else if (!isOnDuty && hasRole) {
                            await guildMember.roles.remove(server.onDutyRoleId).catch(() => {})
                        }
                    }
                } catch (memberError) {}
                
                // Small sleep to prevent hammering Discord Gateway in tight loops
                await new Promise(r => setTimeout(r, 100))
            }
        } catch (serverError: any) {
            console.error(`Error syncing server ${server.name}:`, serverError.message || serverError)
        }
    }
}
