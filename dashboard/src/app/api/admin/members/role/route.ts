
import { getSession } from "@/lib/auth-clerk"
import { verifyCsrf } from "@/lib/auth-permissions"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"

// Update member's role and admin status
export async function PATCH(req: Request) {
    if (!verifyCsrf(req)) return new NextResponse("Forbidden", { status: 403 })
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { memberId, roleId, isAdmin } = await req.json()

        if (!memberId) {
            return NextResponse.json({ error: "Missing memberId" }, { status: 400 })
        }

        // Get the member to check server access
        const member = await prisma.member.findUnique({
            where: { id: memberId }
        })

        if (!member) {
            return NextResponse.json({ error: "Member not found" }, { status: 404 })
        }

        // Check admin access
        const hasAccess = await isServerAdmin(session.user, member.serverId)
        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        const dataToUpdate: any = {}
        if (roleId !== undefined) {
            if (roleId) {
                const role = await prisma.role.findFirst({ where: { id: roleId, serverId: member.serverId } })
                if (!role) {
                    return NextResponse.json({ error: "Role not found in this server" }, { status: 400 })
                }
            }
            dataToUpdate.roleId = roleId || null
        }
        if (isAdmin !== undefined) dataToUpdate.isAdmin = isAdmin

        await prisma.member.update({
            where: { id: memberId },
            data: dataToUpdate
        })

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error("Member update error:", e)
        return NextResponse.json({ error: "Failed to update member" }, { status: 500 })
    }
}
