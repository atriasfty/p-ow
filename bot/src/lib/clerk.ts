import { createClerkClient } from "@clerk/backend"

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY
if (!CLERK_SECRET_KEY) {
    console.error("Missing CLERK_SECRET_KEY")
    process.exit(1)
}

const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY })

// Cache to avoid hitting Clerk API too often
interface CachedUser {
    clerkId: string
    robloxId: string | null
    robloxUsername: string | null
    timestamp: number
}
const userCache = new Map<string, CachedUser>()
const CACHE_TTL = 60000 // 1 minute

export async function getClerkUserByDiscordId(discordId: string): Promise<{
    clerkId: string
    robloxId: string | null
    robloxUsername: string | null
} | null> {
    // Check cache first
    const cached = userCache.get(discordId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return { clerkId: cached.clerkId, robloxId: cached.robloxId, robloxUsername: cached.robloxUsername }
    }

    try {
        // Use Clerk's OAuth filter to find user by Discord external ID
        const users = await clerk.users.getUserList({
            externalId: [discordId],
            limit: 1
        }) as any

        let user = users.data?.[0]

        if (!user) {
            // Fallback: search through users with Discord OAuth (less efficient but catches edge cases)
            // Keep limit 100 for global fetch as this might be correct for a simple bot fetch unless there's an array of IDs
            const allUsers = await clerk.users.getUserList({ limit: 100 }) as any

            for (const u of allUsers.data) {
                const externalAccounts = u.externalAccounts as any[] || []
                const discordAccount = externalAccounts.find(
                    (acc: any) => {
                        const isDiscord = acc.provider === "oauth_discord" || acc.provider === "discord"
                        const idMatch = acc.externalId === discordId || acc.providerUserId === discordId
                        return isDiscord && idMatch
                    }
                )
                if (discordAccount) {
                    user = u
                    break
                }
            }
        }

        if (!user) {
            return null
        }

        // Get Roblox info if linked
        const externalAccounts = user.externalAccounts as any[] || []
        const robloxAccount = externalAccounts.find(
            (acc: any) => acc.provider === "oauth_custom_roblox" || acc.provider === "oauth_roblox" || acc.provider === "roblox"
        )
        const robloxId = robloxAccount?.externalId || robloxAccount?.providerUserId || null
        const robloxUsername = robloxAccount?.username || null

        // Cache the result
        userCache.set(discordId, {
            clerkId: user.id,
            robloxId,
            robloxUsername,
            timestamp: Date.now()
        })

        return { clerkId: user.id, robloxId, robloxUsername }
    } catch (e: any) {
        console.error("Clerk lookup error:", e.message)
        return null
    }
}

// Find member by Discord ID using Clerk lookup
// Returns member with extended info including robloxUsername from Clerk
export async function findMemberByDiscordId(prisma: any, discordId: string, serverId: string) {
    const clerkUser = await getClerkUserByDiscordId(discordId)

    // Build OR conditions for member lookup
    const orConditions: any[] = [
        { discordId } // Direct Discord ID lookup in Member table
    ]

    if (clerkUser) {
        orConditions.push({ userId: clerkUser.clerkId })
        if (clerkUser.robloxId) {
            orConditions.push({ userId: clerkUser.robloxId })
        }
    }

    const member = await prisma.member.findFirst({
        where: {
            serverId,
            OR: orConditions
        },
        include: { server: true, role: true }
    })

    // Attach robloxUsername from Clerk if available
    if (member && clerkUser?.robloxUsername) {
        member._robloxUsername = clerkUser.robloxUsername
    }

    return member
}

// Helper to get Roblox username from a member record
export function getRobloxUsername(member: any, fallback: string): string {
    // Priority: Clerk-resolved username > userId if it looks like a username > fallback
    if (member._robloxUsername) {
        return member._robloxUsername
    }
    // If userId doesn't look like a Clerk ID or numeric ID, it might be a username
    if (member.userId && !member.userId.startsWith("user_") && isNaN(Number(member.userId))) {
        return member.userId
    }
    return fallback
}
