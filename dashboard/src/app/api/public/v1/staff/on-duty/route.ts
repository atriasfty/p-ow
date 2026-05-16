import { prisma } from "@/lib/db"
import { validatePublicApiKey, withRateLimit, resolveServer, logApiAccess } from "@/lib/public-auth"
import { createClerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const auth = await validatePublicApiKey()
    if (!auth.valid) return withRateLimit(NextResponse.json({ error: auth.error }, { status: auth.status || 401 }), auth)

    const { searchParams } = new URL(req.url)
const server = await resolveServer(auth.apiKey)
    if (!server) {
        return withRateLimit(NextResponse.json({ error: "Server not found" }, { status: 404 }), auth)
    }

    try {
        const activeShifts = await prisma.shift.findMany({
            where: { serverId: server.id, endTime: null },
            select: { userId: true, startTime: true }
        })

        if (activeShifts.length === 0) return withRateLimit(NextResponse.json([]), auth)

        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
        const userIds = activeShifts.map((s: any) => s.userId)
        const clerkUsers = await clerk.users.getUserList({ userId: userIds })

        // Pre-compute O(1) lookup Map for Clerk users to avoid O(N*M) lookups inside the loop
        const clerkUserMap = new Map(clerkUsers.data.map((u: any) => [u.id, u]))

        const staffOnDuty = activeShifts.map((shift: any) => {
            const user = clerkUserMap.get(shift.userId)
            if (!user) return null

            const robloxAccount = user.externalAccounts.find((a: any) => {
                const p = a.provider as string
                return p === "roblox" || p === "oauth_roblox" || p === "oauth_custom_roblox" || p === "oauth_custom_custom_roblox"
            })

            return {
                userId: user.id,
                name: (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName) || user.username || "Staff",
                robloxUsername: robloxAccount?.username || "Unknown",
                robloxId: robloxAccount?.externalId || null,
                imageUrl: user.imageUrl,
                shiftStart: shift.startTime
            }
        }).filter(Boolean)

        await logApiAccess(auth.apiKey, "PUBLIC_STAFF_COLLECTED", `Server: ${server.name}`)
        return withRateLimit(NextResponse.json(staffOnDuty), auth)
    } catch (e) {
        console.error("Public Staff API Error:", e)
        return withRateLimit(NextResponse.json({ error: "Internal Error" }, { status: 500 }), auth)
    }
}