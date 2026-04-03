import { getSession } from "@/lib/auth-clerk"
import { verifyCsrf } from "@/lib/auth-permissions"
import { prisma } from "@/lib/db"
import { isSuperAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"

// Revoke admin access - superadmin only
export async function DELETE(req: Request) {
    if (!verifyCsrf(req)) return new NextResponse("Forbidden", { status: 403 })
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    // Only superadmin can revoke access
    if (!isSuperAdmin(session.user)) {
        return NextResponse.json({ error: "Only superadmin can revoke admin access" }, { status: 403 })
    }

    try {
        const { serverId, memberId } = await req.json()

        if (!serverId || !memberId) {
            return NextResponse.json({ error: "Missing serverId or memberId" }, { status: 400 })
        }

        // Get member info before update
        const member = await prisma.member.findUnique({ where: { id: memberId } })

        // Update member to remove admin flag
        await prisma.member.update({
            where: { id: memberId },
            data: { isAdmin: false }
        })

        if (member) {
            await logAudit(
                serverId,
                "ADMIN_REVOKED",
                `Revoked individual admin access from user: ${member.userId}`,
                "DASHBOARD",
                session.user.id
            )
        }

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error("Revoke admin error:", e)
        return NextResponse.json({ error: "Failed to revoke admin access" }, { status: 500 })
    }
}
