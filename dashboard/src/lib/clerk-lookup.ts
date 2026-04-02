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

        // Use Clerk's query parameter to search directly on the backend,
        // which matches against names, emails, and external account IDs.
        const usersResponse = await client.users.getUserList({
            query: robloxId,
            limit: 10 // A query by ID should return very few results
        })

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
