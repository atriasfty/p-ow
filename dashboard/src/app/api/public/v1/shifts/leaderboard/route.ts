import { prisma } from "@/lib/db"
import { validatePublicApiKey, withRateLimit, resolveServer, logApiAccess } from "@/lib/public-auth"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const auth = await validatePublicApiKey()
    if (!auth.valid) return withRateLimit(NextResponse.json({ error: auth.error }, { status: auth.status || 401 }), auth)

    const { searchParams } = new URL(req.url)
    const days = Math.min(parseInt(searchParams.get("days") || "7"), 90)
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50)

    const server = await resolveServer(auth.apiKey)
    if (!server) return withRateLimit(NextResponse.json({ error: "Server not found" }, { status: 404 }), auth)

    try {
        const since = new Date()
        since.setDate(since.getDate() - days)

        // Aggregate total shift duration per user
        const grouped = await prisma.shift.groupBy({
            by: ["userId"],
            where: {
                serverId: server.id,
                startTime: { gte: since },
                endTime: { not: null }
            },
            _sum: { duration: true },
            _count: { id: true },
            orderBy: { _sum: { duration: "desc" } },
            take: limit
        })

        // Fetch member details for the top users
        const userIds = grouped.map(g => g.userId)
        const members = await prisma.member.findMany({
            where: { serverId: server.id, userId: { in: userIds } },
            select: { userId: true, robloxUsername: true, robloxId: true }
        })
        const memberMap = new Map(members.map(m => [m.userId, m]))

        const leaderboard = grouped.map((entry, index) => {
            const member = memberMap.get(entry.userId)
            return {
                rank: index + 1,
                userId: entry.userId,
                robloxUsername: member?.robloxUsername || null,
                robloxId: member?.robloxId || null,
                totalMinutes: Math.round((entry._sum.duration || 0) / 60),
                totalShifts: entry._count.id
            }
        })

        await logApiAccess(auth.apiKey, "PUBLIC_SHIFT_LEADERBOARD", `Server: ${server.name}, Days: ${days}, Top: ${limit}`)

        return withRateLimit(NextResponse.json({
            leaderboard,
            period: { days, since: since.toISOString() }
        }), auth)
    } catch (e) {
        console.error("Public Shift Leaderboard API Error:", e)
        return withRateLimit(NextResponse.json({ error: "Internal Error" }, { status: 500 }), auth)
    }
}
