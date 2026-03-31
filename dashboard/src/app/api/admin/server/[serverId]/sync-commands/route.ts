
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"

export async function POST(
    req: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { serverId } = await params

        // Check admin access
        const hasAccess = await isServerAdmin(session.user as any, serverId)
        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        // Add a sync request to the bot queue
        await prisma.botQueue.create({
            data: {
                serverId,
                type: "SYNC_COMMANDS",
                targetId: "SYSTEM", // Not used for this type
                content: "Manual sync requested from dashboard",
                status: "PENDING"
            }
        })

        // Log the action
        await logAudit(
            serverId,
            "BOT_SYNC_REQUESTED",
            "Triggered manual Discord command synchronization",
            "DASHBOARD",
            session.user.id
        )

        return NextResponse.json({ success: true, message: "Synchronization request queued" })
    } catch (e) {
        console.error("Sync request error:", e)
        return NextResponse.json({ error: "Failed to queue sync request" }, { status: 500 })
    }
}
