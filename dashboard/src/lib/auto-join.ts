import { clerkClient } from "@clerk/nextjs/server"
import { prisma } from "./db"
import { SessionUser } from "./admin"
import PostHogClient from "./posthog"

// Global in-memory store for rate limiting auto-joins
const globalStore = globalThis as unknown as {
    _autoJoinCache: Map<string, number>
}

if (!globalStore._autoJoinCache) {
    globalStore._autoJoinCache = new Map()
}

const autoJoinCache = globalStore._autoJoinCache
const RATE_LIMIT_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Automatically joins the user to any POW servers they are in on Discord.
 * Uses the user's Discord OAuth token to fetch their guilds, ensuring O(1) discord API calls.
 */
export async function performAutoJoin(sessionUser: SessionUser) {
    if (!sessionUser.id || !sessionUser.discordId) return []

    const now = Date.now()
    const lastSync = autoJoinCache.get(sessionUser.id)

    if (lastSync && now - lastSync < RATE_LIMIT_MS) {
        console.log(`[Auto-Join] Rate limited for user ${sessionUser.id}, skipping.`)
        return []
    }

    // Set the sync timestamp immediately to prevent race conditions
    autoJoinCache.set(sessionUser.id, now)

    try {
        const clerk = await clerkClient()
        const tokens = await clerk.users.getUserOauthAccessToken(sessionUser.id, "oauth_discord")

        const discordToken = tokens.data[0]?.token
        if (!discordToken) {
            console.warn(`[Auto-Join] No Discord OAuth token found for user ${sessionUser.id}`)
            return []
        }

        // Fetch user's guilds from Discord
        const guildsRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
            headers: { Authorization: `Bearer ${discordToken}` }
        })

        if (!guildsRes.ok) {
            console.error(`[Auto-Join] Failed to fetch user guilds: ${guildsRes.status} ${guildsRes.statusText}`)
            return []
        }

        const userGuilds: { id: string, name: string }[] = await guildsRes.json()
        const userGuildIds = userGuilds.map(g => g.id)

        if (userGuildIds.length === 0) return []

        // Find all POW servers that match the user's guilds
        const matchedServers = await prisma.server.findMany({
            where: {
                discordGuildId: { in: userGuildIds }
            }
        })

        if (matchedServers.length === 0) return []

        // Find which of these matched servers the user is NOT already a member of
        const existingMemberships = await prisma.member.findMany({
            where: {
                userId: sessionUser.id,
                serverId: { in: matchedServers.map((s: any) => s.id) }
            },
            select: { serverId: true }
        })

        const existingServerIds = new Set(existingMemberships.map((m: any) => m.serverId))

        const newServersToJoin = matchedServers.filter((s: any) => !existingServerIds.has(s.id))

        if (newServersToJoin.length === 0) return []

        const joinedServers: string[] = []
        const newMembersData: any[] = []
        const analyticsEvents: any[] = []

        // ⚡ Bolt: Eliminate N+1 DB queries by fetching all related panel roles in one go
        const newServerIds = newServersToJoin.map((s: any) => s.id)
        const allPanelRoles = await prisma.role.findMany({
            where: { serverId: { in: newServerIds }, discordRoleId: { not: null } }
        })

        // Group panel roles by serverId for O(1) lookups
        const panelRolesByServer = new Map<string, typeof allPanelRoles>()
        for (const role of allPanelRoles) {
            if (!panelRolesByServer.has(role.serverId)) {
                panelRolesByServer.set(role.serverId, [])
            }
            panelRolesByServer.get(role.serverId)!.push(role)
        }

        // Now, we must check their roles in each guild to assign them the correct POW permissions
        // We resolve the bot token per server to support White Label Bots

        await Promise.all(newServersToJoin.map(async (server: typeof newServersToJoin[0]) => {
            try {
                const botToken = server.customBotEnabled && server.customBotToken 
                    ? server.customBotToken 
                    : process.env.DISCORD_BOT_TOKEN
                    
                if (!botToken) return
                const guildMemberRes = await fetch(
                    `https://discord.com/api/v10/guilds/${server.discordGuildId}/members/${sessionUser.discordId}`,
                    { headers: { Authorization: `Bot ${botToken}` } }
                )

                if (!guildMemberRes.ok) return

                const guildMemberData = await guildMemberRes.json()
                const userDiscordRoles: string[] = guildMemberData.roles || []

                // Check for suspended/terminated
                if (server.terminatedRoleId && userDiscordRoles.includes(server.terminatedRoleId)) {
                    // Do not add them, maybe delete account but we skip for now
                    return
                }
                if (server.suspendedRoleId && userDiscordRoles.includes(server.suspendedRoleId)) {
                    return
                }

                // ⚡ Bolt: Lookup pre-fetched panel roles using O(1) hash map
                const panelRoles = panelRolesByServer.get(server.id) || []

                // Get role hierarchy
                const guildRolesRes = await fetch(
                    `https://discord.com/api/v10/guilds/${server.discordGuildId}/roles`,
                    { headers: { Authorization: `Bot ${botToken}` } }
                )

                let bestRoleId: string | null = null

                if (guildRolesRes.ok) {
                    const guildRoles: { id: string; position: number }[] = await guildRolesRes.json()
                    const rolePositionMap = new Map(guildRoles.map(r => [r.id, r.position]))

                    let bestPosition = -1

                    for (const panelRole of panelRoles) {
                        if (!panelRole.discordRoleId) continue
                        if (userDiscordRoles.includes(panelRole.discordRoleId)) {
                            const position = rolePositionMap.get(panelRole.discordRoleId) || 0
                            if (position > bestPosition) {
                                bestPosition = position
                                bestRoleId = panelRole.id
                            }
                        }
                    }
                }

                // Check if user is staff or has a role
                const isStaff = server.staffRoleId && userDiscordRoles.includes(server.staffRoleId)

                if (bestRoleId || isStaff) {
                    // ⚡ Bolt: Collect member data for batch insertion instead of N+1 creates
                    newMembersData.push({
                        userId: sessionUser.id,
                        serverId: server.id,
                        discordId: sessionUser.discordId,
                        robloxId: sessionUser.robloxId,
                        robloxUsername: sessionUser.robloxUsername,
                        roleId: bestRoleId,
                        isAdmin: false
                    })

                    joinedServers.push(server.id)

                    // ⚡ Bolt: Collect analytics events for batch dispatch
                    analyticsEvents.push({
                        distinctId: sessionUser.id,
                        event: "user_auto_joined_server",
                        properties: { serverId: server.id, guildId: server.discordGuildId }
                    })
                }

            } catch (e) {
                console.error(`[Auto-Join] Failed to process auto-join for server ${server.id}:`, e)
            }
        }))

        // ⚡ Bolt: Execute batched inserts and dispatch analytics
        if (newMembersData.length > 0) {
            await prisma.member.createMany({
                data: newMembersData
            })

            const posthog = PostHogClient()
            analyticsEvents.forEach(evt => posthog.capture(evt))
        }

        return joinedServers

    } catch (error) {
        console.error("[Auto-Join] Core error:", error)
        return []
    }
}
