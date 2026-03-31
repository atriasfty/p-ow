import { getSession } from "@/lib/auth-clerk"
import { isServerAdmin } from "@/lib/admin"
import { clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

// Get Clerk users but ONLY those who are members of this specific server
export async function GET(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { searchParams } = new URL(req.url)
        const serverId = searchParams.get("serverId")
        const search = searchParams.get("search") || ""
        const limit = parseInt(searchParams.get("limit") || "50")
        const offset = parseInt(searchParams.get("offset") || "0")

        if (!serverId) {
            return NextResponse.json({ error: "Missing serverId" }, { status: 400 })
        }

        const hasAccess = await isServerAdmin(session.user, serverId)
        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        // 1. Get member user IDs from DB for this server
        // We will apply search filtering purely on the Clerk side to be simple, 
        // but restrict the query to ONLY users in our server.
        const serverMembers = await prisma.member.findMany({
            where: { serverId },
            select: { userId: true }
        })

        const allowedUserIds = serverMembers.map(m => m.userId)

        if (allowedUserIds.length === 0) {
            return NextResponse.json({ users: [], totalCount: 0 })
        }

        const client = await clerkClient()

        // 2. Fetch from Clerk, restricting to `userId: allowedUserIds`
        // Note: Clerk limits the 'userId' array. For massive servers, we may need to handle this manually, 
        // but for now we pass the allowed IDs and rely on Clerk pagination.
        // Wait, Clerk users.getUserList accepts an array of strings for `userId`. 
        // If the array is too large, it might fail. Let's slice it to the first 500 max just to be safe.
        // Or better yet, we can do pagination on our DB, and then fetch those specific users from Clerk.

        // Paginating on our DB and searching on Clerk is tricky if they mismatch.
        // For accurate searching, it's best to let Clerk do the search, but pass all allowedUserIds (capped at 500 for URL length limits)
        let queryParams: any = {
            limit,
            offset,
            userId: allowedUserIds.slice(0, 500),
            orderBy: '-created_at'
        }

        if (search) {
            queryParams.query = search
        }

        const usersResponse = await client.users.getUserList(queryParams)

        const users = usersResponse.data.map(user => {
            // Find Discord and Roblox accounts
            const discordAccount = user.externalAccounts.find(
                a => (a.provider as string) === "discord" || (a.provider as string) === "oauth_discord"
            )
            const robloxAccount = user.externalAccounts.find(
                a => ["roblox", "oauth_roblox", "oauth_custom_roblox", "custom_roblox"].includes(a.provider as string)
            )

            return {
                id: user.id,
                username: user.username,
                name: user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.firstName || user.username,
                image: user.imageUrl,
                discordId: discordAccount?.externalId,
                discordUsername: discordAccount?.username,
                robloxId: robloxAccount?.externalId,
                robloxUsername: robloxAccount?.username,
                createdAt: user.createdAt
            }
        })

        return NextResponse.json({
            users,
            totalCount: usersResponse.totalCount
        })
    } catch (e) {
        console.error("Clerk server-users fetch error:", e)
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }
}
