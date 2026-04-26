
import { prisma } from "./db"

/**
 * Re-verifies a user's roles in Discord and updates their Member record in the database.
 * This is used for Just-In-Time (JIT) security verification.
 */
export async function verifyMemberRoles(userId: string, serverId: string) {
    try {
        const server = await prisma.server.findUnique({
            where: { id: serverId }
        })

        if (!server || !server.discordGuildId) return null

        const botToken = server.customBotEnabled && server.customBotToken
            ? server.customBotToken
            : process.env.DISCORD_BOT_TOKEN

        if (!botToken) return null

        // 1. Get member record to find Discord ID
        const member = await prisma.member.findUnique({
            where: { userId_serverId: { userId, serverId } }
        })

        const discordId = member?.discordId
        if (!discordId) return null

        // 2. Fetch current member data from Discord
        const guildMemberRes = await fetch(
            `https://discord.com/api/v10/guilds/${server.discordGuildId}/members/${discordId}`,
            { headers: { Authorization: `Bot ${botToken}` } }
        )

        // 3. Handle user left guild
        if (!guildMemberRes.ok) {
            if (guildMemberRes.status === 404) {
                console.log(`[JIT-Verify] User ${userId} not in guild ${server.discordGuildId}, removing member record.`)
                await prisma.member.delete({
                    where: { userId_serverId: { userId, serverId } }
                }).catch(() => { })
                return null
            }
            throw new Error(`Discord API error: ${guildMemberRes.status}`)
        }

        const guildMemberData = await guildMemberRes.json()
        const userDiscordRoles: string[] = guildMemberData.roles || []

        // 4. Handle terminated/suspended
        if (server.terminatedRoleId && userDiscordRoles.includes(server.terminatedRoleId)) {
            console.log(`[JIT-Verify] User ${userId} is terminated, removing member record.`)
            await prisma.member.delete({
                where: { userId_serverId: { userId, serverId } }
            }).catch(() => { })
            return null
        }

        // 5. Re-evaluate panel roles
        const panelRoles = await prisma.role.findMany({
            where: { serverId, discordRoleId: { not: null } }
        })

        const guildRolesRes = await fetch(
            `https://discord.com/api/v10/guilds/${server.discordGuildId}/roles`,
            { headers: { Authorization: `Bot ${botToken}` } }
        )

        if (!guildRolesRes.ok) {
            // Can't determine the user's role without guild role data — return existing record unchanged
            // rather than wiping their role on a transient Discord API failure.
            console.warn(`[JIT-Verify] Failed to fetch guild roles for ${server.discordGuildId}: ${guildRolesRes.status}. Skipping update.`)
            return member
        }

        const guildRoles: { id: string; position: number }[] = await guildRolesRes.json()
        const rolePositionMap = new Map(guildRoles.map(r => [r.id, r.position]))

        let bestRoleId: string | null = null
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

        // 6. Update Member Record
        const isAdmin = bestRoleId ? (panelRoles.find(r => r.id === bestRoleId)?.canAccessAdmin || false) : false

        const updatedMember = await prisma.member.update({
            where: { userId_serverId: { userId, serverId } },
            data: {
                roleId: bestRoleId,
                isAdmin,
                lastVerifiedAt: new Date()
            },
            include: { role: true }
        })

        return updatedMember

    } catch (e) {
        console.error(`[JIT-Verify] Error for user ${userId} on server ${serverId}:`, e)
        return null
    }
}
