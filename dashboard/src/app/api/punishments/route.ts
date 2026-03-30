import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { checkSecurity } from "@/lib/security"
import { verifyPermissionOrError } from "@/lib/auth-permissions"

export async function GET(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")
    const userId = searchParams.get("userId")

    if (!serverId) return new NextResponse("Missing serverId", { status: 400 })

    // Permission check - require canViewPunishments
    const permError = await verifyPermissionOrError(session.user, serverId, "canViewPunishments")
    if (permError) return permError

    const securityBlock = await checkSecurity(req)
    if (securityBlock) return securityBlock

    try {
        const whereClause: any = { serverId }
        if (userId) whereClause.userId = userId

        // Pagination parameters
        const limit = parseInt(searchParams.get("limit") || "30")
        const cursor = searchParams.get("cursor")

        const punishments = await prisma.punishment.findMany({
            where: whereClause,
            orderBy: { createdAt: "desc" },
            take: limit + 1, // Fetch one extra to check if there are more
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
        })

        const hasMore = punishments.length > limit
        const items = hasMore ? punishments.slice(0, -1) : punishments
        const nextCursor = hasMore ? items[items.length - 1]?.id : null

        // Enhancement: Resolve Moderator Names via Clerk
        // 1. Collect unique Moderator IDs
        const modIds = Array.from(new Set(punishments.map((p: any) => p.moderatorId))) as string[]

        // 2. Separate into Clerk IDs (user_*) and Discord IDs (numeric)
        const clerkIds = modIds.filter(id => id.startsWith("user_"))
        const discordIds = modIds.filter(id => !id.startsWith("user_"))

        // 3. Resolve Discord IDs to Clerk IDs via Member table
        if (discordIds.length > 0) {
            const members = await prisma.member.findMany({
                where: {
                    discordId: { in: discordIds },
                    serverId
                },
                select: { userId: true, discordId: true }
            })
            // Add resolved Clerk IDs to the list
            members.forEach((m: any) => {
                if (m.userId) clerkIds.push(m.userId)
            })
        }

        // 4. Fetch User Details from Clerk
        const client = await clerkClient()
        let users: any[] = []
        try {
            const userList = await client.users.getUserList({ userId: clerkIds })
            users = userList.data
        } catch (e) {
            console.error("Clerk fetch error", e)
        }

        // 5. Build Map: ModeratorID -> { name, avatar }
        const modMap = new Map()

        // PRE-LOAD: Resolve all Discord IDs to Members in one go
        const discordModIds = modIds.filter(id => !id.startsWith("user_"))
        const discordToMemberMap = new Map()

        if (discordModIds.length > 0) {
            const members = await prisma.member.findMany({
                where: { discordId: { in: discordModIds }, serverId },
                select: { discordId: true, userId: true }
            })
            members.forEach((m: any) => discordToMemberMap.set(m.discordId, m.userId))
        }

        for (const modId of modIds) {
            let user = null
            const clerkId = modId.startsWith("user_") ? modId : discordToMemberMap.get(modId)

            if (clerkId) {
                user = (users as any[]).find(u => u.id === clerkId)
            }

            if (user) {
                // Extract Roblox info
                const robloxAccount = user.externalAccounts.find((a: any) =>
                    a.provider === "roblox" || a.provider === "oauth_roblox" || a.provider === "oauth_custom_roblox"
                )

                modMap.set(modId, {
                    name: robloxAccount?.username || user.username || "Unknown",
                    avatar: robloxAccount?.imageUrl || user.imageUrl
                })
            } else if (modId && !modId.startsWith("user_") && isNaN(Number(modId))) {
                // Manual Roblox username from :log command
                modMap.set(modId, { name: modId, avatar: null })
            } else {
                modMap.set(modId, { name: modId || "System/Unknown", avatar: null })
            }
        }

        // 6. Enrich Response
        const enriched = items.map((p: any) => {
            const modInfo = modMap.get(p.moderatorId)
            return {
                ...p,
                moderatorName: modInfo?.name,
                moderatorAvatar: modInfo?.avatar
            }
        })

        return NextResponse.json({
            items: enriched,
            hasMore,
            nextCursor
        })
    } catch (e) {
        console.error("Punishment fetch error:", e)
        return new NextResponse("Error fetching punishments", { status: 500 })
    }
}
