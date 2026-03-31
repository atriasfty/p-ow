import { prisma } from "@/lib/db"
import { validatePublicApiKey, withRateLimit, resolveServer, logApiAccess } from "@/lib/public-auth"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const auth = await validatePublicApiKey()
    if (!auth.valid) return withRateLimit(NextResponse.json({ error: auth.error }, { status: auth.status || 401 }), auth)

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")
    const days = Math.min(parseInt(searchParams.get("days") || "7"), 90)
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const page = parseInt(searchParams.get("page") || "1")

    const server = await resolveServer(auth.apiKey)
    if (!server) return withRateLimit(NextResponse.json({ error: "Server not found" }, { status: 404 }), auth)

    try {
        const since = new Date()
        since.setDate(since.getDate() - days)

        const where: any = {
            serverId: server.id,
            startTime: { gte: since },
            endTime: { not: null }
        }
        if (userId) where.userId = userId

        const [shifts, total] = await Promise.all([
            prisma.shift.findMany({
                where,
                orderBy: { startTime: "desc" },
                take: limit,
                skip: (page - 1) * limit,
                select: {
                    id: true,
                    userId: true,
                    startTime: true,
                    endTime: true,
                    duration: true
                }
            }),
            prisma.shift.count({ where })
        ])

        // Calculate total minutes for the queried user/period
        const totalSeconds = shifts.reduce((sum, s) => sum + (s.duration || 0), 0)

        await logApiAccess(auth.apiKey, "PUBLIC_SHIFT_HISTORY", `Server: ${server.name}, User: ${userId || "all"}, Days: ${days}`)

        return withRateLimit(NextResponse.json({
            shifts,
            totalShifts: total,
            totalMinutes: Math.round(totalSeconds / 60),
            period: { days, since: since.toISOString() },
            pagination: { page, limit, totalPages: Math.ceil(total / limit) }
        }), auth)
    } catch (e) {
        console.error("Public Shift History API Error:", e)
        return withRateLimit(NextResponse.json({ error: "Internal Error" }, { status: 500 }), auth)
    }
}
