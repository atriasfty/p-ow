
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { verifyPermissionOrError, verifyCsrf } from "@/lib/auth-permissions"
import { eventBus } from "@/lib/event-bus"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!verifyCsrf(req)) return new NextResponse("CSRF verification failed", { status: 403 })

    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { id } = await params

    const punishment = await prisma.punishment.findUnique({ where: { id } })
    if (!punishment) return new NextResponse("Not Found", { status: 404 })

    const error = await verifyPermissionOrError(session.user, punishment.serverId, "canBan")
    if (error) return error

    try {
        await prisma.punishment.delete({ where: { id } })
        // Notify SSE clients of deletion
        eventBus.emit(punishment.serverId, 'punishments', { action: 'deleted', punishment: { id } })
        return NextResponse.json({ success: true })
    } catch (e) {
        console.error("Delete punishment error:", e)
        return new NextResponse("Failed to delete", { status: 500 })
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!verifyCsrf(req)) return new NextResponse("CSRF verification failed", { status: 403 })

    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { id } = await params
    const body = await req.json()

    const punishment = await prisma.punishment.findUnique({ where: { id } })
    if (!punishment) return new NextResponse("Not Found", { status: 404 })

    const baseError = await verifyPermissionOrError(session.user, punishment.serverId, "canViewPunishments")
    if (baseError) return baseError

    // Reason edits require ban permission to prevent history tampering
    if (body.reason !== undefined) {
        const banError = await verifyPermissionOrError(session.user, punishment.serverId, "canBan")
        if (banError) return banError
    }

    if (body.resolved !== undefined && punishment.type === "Ban Bolo") {
        const boloError = await verifyPermissionOrError(session.user, punishment.serverId, "canManageBolos")
        if (boloError) return boloError
    }

    try {
        const updateData: { reason?: string, resolved?: boolean } = {}
        if (body.reason !== undefined) updateData.reason = body.reason
        if (body.resolved !== undefined) updateData.resolved = body.resolved

        const updated = await prisma.punishment.update({ where: { id }, data: updateData })
        // Notify SSE clients of update
        eventBus.emit(punishment.serverId, 'punishments', { action: 'updated', punishment: updated })
        return NextResponse.json(updated)
    } catch (e) {
        console.error("Update punishment error:", e)
        return new NextResponse("Failed to update", { status: 500 })
    }
}
