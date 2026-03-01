import { getSession } from "@/lib/auth-clerk"
import { isSuperAdmin } from "@/lib/admin"
import { clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

// Get all Clerk users for admin panel - Superadmin only
export async function GET(req: Request) {
    const session = await getSession()
    if (!session || !isSuperAdmin(session.user)) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { searchParams } = new URL(req.url)
        const search = searchParams.get("search") || ""
        const limit = parseInt(searchParams.get("limit") || "50")
        const offset = parseInt(searchParams.get("offset") || "0")

        const client = await clerkClient()

        // Get users with pagination
        const usersResponse = await client.users.getUserList({
            limit,
            offset,
            query: search || undefined,
            orderBy: '-created_at'
        })

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
        console.error("Clerk users fetch error:", e)
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }
}
