import { prisma } from "@/lib/db"
import { getSession } from "@/lib/auth-clerk"
import { isServerAdmin, isSuperAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const session = await getSession()
    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")

    if (!session || !serverId) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    const hasAccess = await isServerAdmin(session.user, serverId)
    if (!hasAccess) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    try {
        // Fetch security logs (which stores serverId in the userId column loosely for public API tracking)
        // Also fetch general activity automations/webhooks if added later.
        const logs = await prisma.securityLog.findMany({
            where: {
                OR: [
                    { userId: serverId }, // API logs
                    { details: { contains: serverId } } // Other logs that might reference it
                ]
            },
            orderBy: { createdAt: "desc" },
            take: 100
        })

        return NextResponse.json({ logs })
    } catch (e) {
        console.error("Audit log error:", e)
        return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 })
    }
}
