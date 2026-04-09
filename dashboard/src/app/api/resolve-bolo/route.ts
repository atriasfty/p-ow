import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { hasPermission } from "@/lib/admin"
import { NextResponse } from "next/server"
import { verifyCsrf } from "@/lib/auth-permissions"

export async function POST(req: Request) {
    if (!verifyCsrf(req)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    if (!verifyCsrf(req)) {
        return new NextResponse("CSRF validation failed", { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return new NextResponse("Missing ID", { status: 400 })

    try {
        // 1. Find the punishment to get the serverId
        const punishment = await prisma.punishment.findUnique({
            where: { id },
            select: { serverId: true }
        })

        if (!punishment) {
            return new NextResponse("Punishment not found", { status: 404 })
        }

        // 2. Check if user has permission to manage BOLOs on this server
        const canManage = await hasPermission(session.user as any, punishment.serverId, "canManageBolos")
        if (!canManage) {
            return new NextResponse("Forbidden: Missing permissions", { status: 403 })
        }

        await prisma.punishment.update({
            where: { id },
            data: { resolved: true }
        })
        return NextResponse.json({ success: true })
    } catch (e) {
        console.error("[RESOLVE BOLO]", e)
        return new NextResponse("Error resolving", { status: 500 })
    }
}
