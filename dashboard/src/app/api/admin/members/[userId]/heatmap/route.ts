import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"

export async function GET(
    req: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { userId } = await params
    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")

    if (!serverId) return new NextResponse("Missing serverId", { status: 400 })

    // Check permissions
    if (!await isServerAdmin(session.user as any, serverId)) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    try {
        // Get shifts for the last 365 days
        const oneYearAgo = new Date()
        oneYearAgo.setDate(oneYearAgo.getDate() - 365)
        oneYearAgo.setHours(0, 0, 0, 0)

        const shifts = await prisma.shift.findMany({
            where: {
                serverId,
                userId,
                startTime: { gte: oneYearAgo },
                endTime: { not: null }
            },
            select: {
                startTime: true,
                duration: true
            }
        })

        // Bucket by day (YYYY-MM-DD)
        const heatmap: Record<string, number> = {}

        shifts.forEach(shift => {
            const date = shift.startTime.toISOString().split("T")[0]
            heatmap[date] = (heatmap[date] || 0) + (shift.duration || 0)
        })

        // Format for frontend (array of { date, value })
        const data = Object.entries(heatmap).map(([date, value]) => ({
            date,
            value: Math.floor(value / 60) // Convert to minutes
        }))

        return NextResponse.json(data)
    } catch (e) {
        console.error("Heatmap fetch error:", e)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
