import { prisma } from "@/lib/db"
import { getSession } from "@/lib/auth-clerk"
import { isServerAdmin, isSuperAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const session = await getSession()
    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")

    try {
        const { searchParams } = new URL(req.url)
        const serverId = searchParams.get("serverId")
        const origin = searchParams.get("origin")
        const event = searchParams.get("event")

        if (!session || !serverId) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const hasAccess = await isServerAdmin(session.user, serverId)
        if (!hasAccess) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const where: any = { serverId }
        if (origin) where.origin = origin
        if (event) where.event = { contains: event }

        const logs = await (prisma.securityLog as any).findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 100
        })

        // Build identity map from Member table
        const members = await prisma.member.findMany({
            where: { serverId },
            select: { userId: true, robloxUsername: true }
        })

        const userMap = new Map(members.map(m => [m.userId, m.robloxUsername || "Unknown"]))

        const enrichedLogs = logs.map((log: any) => ({
            ...log,
            creatorName: log.creatorId ? (userMap.get(log.creatorId) || log.creatorId) : "System"
        }))

        return NextResponse.json({ logs: enrichedLogs })
    } catch (e) {
        console.error("Audit log error:", e)
        return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 })
    }
}
