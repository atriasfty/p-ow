
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"
import { verifyCsrf } from "@/lib/auth-permissions"

// Delete LOA
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!verifyCsrf(req)) return new NextResponse("Forbidden", { status: 403 })
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { id } = await params
        
        const loa = await prisma.leaveOfAbsence.findUnique({ where: { id } })
        if (!loa) {
            return NextResponse.json({ error: "LOA not found" }, { status: 404 })
        }

        const hasAccess = await isServerAdmin(session.user, loa.serverId)
        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        await prisma.leaveOfAbsence.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error("LOA delete error:", e)
        return NextResponse.json({ error: "Failed to delete LOA" }, { status: 500 })
    }
}
