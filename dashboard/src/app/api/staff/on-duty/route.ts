import { createClerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth-clerk"
import { isServerMember } from "@/lib/admin"

export async function GET(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")

    if (!serverId) return new NextResponse("Missing serverId", { status: 400 })

    // Verify user is a member of this server
    if (!await isServerMember(session.user as any, serverId)) {
        return new NextResponse("Forbidden: Access denied to this server", { status: 403 })
    }

    try {
        // 1. Get active shifts
        const activeShifts = await prisma.shift.findMany({
            where: {
                serverId,
                endTime: null
            },
            select: {
                userId: true,
                startTime: true
            }
        })

        if (activeShifts.length === 0) {
            return NextResponse.json([])
        }

        // 2. Fetch user details from Clerk
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
        const userIds = activeShifts.map((s: any) => s.userId)

        // Clerk getUserList can take an array of userIds
        const clerkUsers = await clerk.users.getUserList({
            userId: userIds
        })

        const userMap = new Map(clerkUsers.data.map(u => [u.id, u]))

        // 3. Map active shifts to Clerk users (ensures we show everyone we can find)
        const staffOnDuty = activeShifts.map((shift: any) => {
            const user = userMap.get(shift.userId)
            if (!user) return null

            // Find roblox username from external accounts
            const robloxAccount = user.externalAccounts.find((a: any) => {
                const provider = a.provider as string
                return provider === "roblox" || provider === "oauth_roblox" || provider === "oauth_custom_roblox" || provider === "oauth_custom_custom_roblox"
            })

            return {
                userId: user.id,
                name: (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName) || user.username || "Staff",
                username: user.username,
                robloxUsername: robloxAccount?.username || "Unknown",
                imageUrl: user.imageUrl,
                shiftStart: shift?.startTime
            }
        }).filter(Boolean)

        return NextResponse.json(staffOnDuty)

    } catch (error) {
        console.error("Failed to fetch on-duty staff:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}