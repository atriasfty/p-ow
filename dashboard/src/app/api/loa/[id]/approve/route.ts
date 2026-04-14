
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"
import { verifyCsrf } from "@/lib/auth-permissions"

// Approve LOA
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    if (!verifyCsrf(req)) {
        return new NextResponse("CSRF validation failed", { status: 403 })
    }

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

        const member = await prisma.member.findFirst({
            where: { serverId: loa.serverId, userId: loa.userId }
        })

        await prisma.leaveOfAbsence.update({
            where: { id },
            data: {
                status: "approved",
                robloxUsername: member?.robloxUsername || loa.robloxUsername,
                reviewedBy: session.user.robloxId || session.user.discordId || session.user.id,
                reviewedAt: new Date()
            }
        })

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error("LOA approve error:", e)
        return NextResponse.json({ error: "Failed to approve LOA" }, { status: 500 })
    }
}
