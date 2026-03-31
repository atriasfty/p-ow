import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isSuperAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"

// Grant admin access - superadmin only
export async function POST(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    // Only superadmin can grant access
    if (!isSuperAdmin(session.user)) {
        return NextResponse.json({ error: "Only superadmin can grant admin access" }, { status: 403 })
    }

    try {
        const { serverId, userId } = await req.json()

        if (!serverId || !userId) {
            return NextResponse.json({ error: "Missing serverId or userId" }, { status: 400 })
        }

        // Upsert member with admin flag
        const member = await prisma.member.upsert({
            where: {
                userId_serverId: { userId, serverId }
            },
            create: {
                userId,
                serverId,
                isAdmin: true
            },
            update: {
                isAdmin: true
            }
        })

        await logAudit(
            serverId,
            "ADMIN_GRANTED",
            `Granted individual admin access to user: ${userId}`,
            "DASHBOARD",
            session.user.id
        )

        return NextResponse.json({ success: true, id: member.id })
    } catch (e) {
        console.error("Grant admin error:", e)
        return NextResponse.json({ error: "Failed to grant admin access" }, { status: 500 })
    }
}
