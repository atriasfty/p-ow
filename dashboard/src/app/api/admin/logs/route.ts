import { getSession } from "@/lib/auth-clerk"
import { verifyPermissionOrError } from "@/lib/auth-permissions"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")
    const playerId = searchParams.get("playerId")
    const type = searchParams.get("type")
    const limit = parseInt(searchParams.get("limit") || "100")

    if (!serverId) return NextResponse.json({ error: "Missing serverId" }, { status: 400 })

    // Verify permission - require canViewLogs
    const error = await verifyPermissionOrError(session.user, serverId, "canViewLogs")
    if (error) return error

    // Build query
    const whereClause: any = {
        serverId,
        type: type || undefined,
        playerId: playerId || undefined
    }

    try {
        const logs = await prisma.log.findMany({
            where: whereClause,
            orderBy: { createdAt: "desc" },
            take: limit,
            select: {
                id: true,
                type: true,
                command: true,
                createdAt: true,
                playerId: true,
                playerName: true
            }
        })

        return NextResponse.json({ logs })
    } catch (e) {
        console.error("Error fetching admin logs:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
