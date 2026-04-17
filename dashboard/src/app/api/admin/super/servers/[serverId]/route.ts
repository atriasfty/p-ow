import { getSession } from "@/lib/auth-clerk"
import { isSuperAdmin } from "@/lib/admin"
import { verifyCsrf } from "@/lib/auth-permissions"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const session = await getSession()
    if (!session || !isSuperAdmin(session.user as any)) {
        return new NextResponse("Unauthorized", { status: 401 })
    }
    if (!verifyCsrf(req)) return new NextResponse("Forbidden", { status: 403 })

    const { serverId } = await params

    try {
        const body = await req.json()
        const { name, customName, apiUrl, discordGuildId, subscriberUserId, subscriptionPlan } = body

        const updatedServer = await prisma.server.update({
            where: { id: serverId },
            data: {
                name,
                customName,
                apiUrl,
                discordGuildId,
                subscriberUserId,
                subscriptionPlan
            }
        })

        return NextResponse.json({ success: true, server: updatedServer })
    } catch (error) {
        console.error("Superadmin server update error:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const session = await getSession()
    if (!session || !isSuperAdmin(session.user as any)) {
        return new NextResponse("Unauthorized", { status: 401 })
    }
    if (!verifyCsrf(req)) return new NextResponse("Forbidden", { status: 403 })

    const { serverId } = await params

    try {
        // We use a transaction or rely on onDelete: Cascade in Prisma schema
        // The schema shows many relations have onDelete: Cascade
        await prisma.server.delete({
            where: { id: serverId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Superadmin server delete error:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
