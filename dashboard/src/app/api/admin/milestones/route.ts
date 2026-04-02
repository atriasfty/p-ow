import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { verifyCsrf } from "@/lib/auth-permissions"
import { NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"

// GET /api/admin/milestones?serverId=xxx
export async function GET(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")

    if (!serverId) return new NextResponse("Missing serverId", { status: 400 })

    const isAdmin = await isServerAdmin(session.user, serverId)
    if (!isAdmin) return new NextResponse("Forbidden", { status: 403 })

    const milestones = await prisma.staffMilestone.findMany({
        where: { serverId },
        orderBy: { requiredMinutes: "asc" }
    })

    return NextResponse.json(milestones)
}

// POST /api/admin/milestones
export async function POST(req: Request) {
    if (!verifyCsrf(req)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }

    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { serverId, name, requiredMinutes, rewardRoleId } = await req.json()

        if (!serverId || !name || requiredMinutes === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        const isAdmin = await isServerAdmin(session.user, serverId)
        if (!isAdmin) return new NextResponse("Forbidden", { status: 403 })

        const milestone = await prisma.staffMilestone.create({
            data: {
                serverId,
                name,
                requiredMinutes: parseInt(requiredMinutes),
                rewardRoleId: rewardRoleId || null
            }
        })

        await logAudit(
            serverId,
            "MILESTONE_CREATED",
            `Created milestone: ${name} (${requiredMinutes} minutes)`,
            "DASHBOARD",
            session.user.id
        )

        return NextResponse.json(milestone)
    } catch (e: any) {
        console.error("[MILESTONES POST]", e)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// DELETE /api/admin/milestones?serverId=xxx&id=xxx
export async function DELETE(req: Request) {
    if (!verifyCsrf(req)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }

    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")
    const id = searchParams.get("id")

    if (!serverId || !id) return new NextResponse("Missing fields", { status: 400 })

    const isAdmin = await isServerAdmin(session.user, serverId)
    if (!isAdmin) return new NextResponse("Forbidden", { status: 403 })

    // Verify it belongs to the server first
    const exists = await prisma.staffMilestone.findFirst({
        where: { id, serverId }
    })
    if (!exists) return new NextResponse("Not found", { status: 404 })

    await prisma.staffMilestone.delete({
        where: { id }
    })

    await logAudit(
        serverId,
        "MILESTONE_DELETED",
        `Deleted milestone: ${exists.name}`,
        "DASHBOARD",
        session.user.id
    )

    return NextResponse.json({ success: true })
}
