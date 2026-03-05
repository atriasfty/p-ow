import { clerkClient } from "@clerk/nextjs/server"
import { prisma } from "./db"

// Cache for Clerk lookups to avoid rate limits
interface CachedClerkUser {
    clerkId: string
    discordId: string | null
    timestamp: number
}
const robloxToClerkCache = new Map<string, CachedClerkUser | null>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours (aggressive caching)

/**
 * Find a Clerk user by their Roblox ID
 */
export async function getClerkUserByRobloxId(robloxId: string): Promise<{
    clerkId: string
    discordId: string | null
} | null> {
    // Check cache
    const cached = robloxToClerkCache.get(robloxId)
    if (cached !== undefined && Date.now() - (cached?.timestamp || 0) < CACHE_TTL) {
        return cached ? { clerkId: cached.clerkId, discordId: cached.discordId } : null
    }

    try {
        const client = await clerkClient()

        // Search through all users to find one with matching Roblox external account
        // Note: Clerk doesn't have a direct lookup by external account ID
        // We use pagination to ensure we check all users
        let offset = 0
        const limit = 100
        let hasMore = true

        while (hasMore) {
            const usersResponse = await client.users.getUserList({ 
                limit, 
                offset,
                orderBy: '-created_at' // Check newest users first as they are more likely to be active
            })

            if (usersResponse.data.length === 0) break

            for (const user of usersResponse.data) {
                const externalAccounts = user.externalAccounts || []
                const robloxAccount = externalAccounts.find(
                    (acc: any) => {
                        const isRoblox = acc.provider === "oauth_custom_roblox" ||
                            acc.provider === "oauth_roblox" ||
                            acc.provider === "roblox"
                        const idMatch = acc.externalId === robloxId ||
                            acc.providerUserId === robloxId
                        return isRoblox && idMatch
                    }
                )

                if (robloxAccount) {
                    // Found the user - get Discord ID too
                    const discordAccount = externalAccounts.find(
                        (acc: any) => acc.provider === "oauth_discord" || acc.provider === "discord"
                    )
                    const discordId = (discordAccount as any)?.externalId ||
                        (discordAccount as any)?.providerUserId || null

                    const result = { clerkId: user.id, discordId }
                    robloxToClerkCache.set(robloxId, { ...result, timestamp: Date.now() })
                    return result
                }
            }

            offset += limit
            hasMore = usersResponse.data.length === limit
            
            // Safety cap: don't loop forever if something goes wrong, 
            // though usersResponse.data.length check should handle it.
            if (offset > 10000) break 
        }

        // Not found
        robloxToClerkCache.set(robloxId, null)
        return null
    } catch (e: any) {
        console.error("[CLERK] Error looking up user by Roblox ID:", e.message)
        return null
    }
}

/**
 * Find a Member by Roblox ID
 * Looks up Clerk to find the user, then finds the corresponding Member record
 */
export async function findMemberByRobloxId(serverId: string, robloxId: string) {
    // Build list of possible userIds to search
    const possibleUserIds: string[] = [robloxId]

    // Look up Clerk to find the user's Clerk ID and Discord ID
    const clerkUser = await getClerkUserByRobloxId(robloxId)

    if (clerkUser) {
        possibleUserIds.push(clerkUser.clerkId)
        if (clerkUser.discordId) {
            possibleUserIds.push(clerkUser.discordId)
        }
    }

    console.log(`[MEMBER-LOOKUP] Roblox ${robloxId} -> Search userIds: ${possibleUserIds.join(", ")}`)

    // Find member by any of these IDs
    const member = await prisma.member.findFirst({
        where: {
            serverId,
            OR: [
                { userId: { in: possibleUserIds } },
                { discordId: { in: possibleUserIds } }
            ]
        },
        include: { role: true }
    })

    return {
        member,
        clerkId: clerkUser?.clerkId || null,
        discordId: clerkUser?.discordId || null,
        possibleUserIds
    }
}
