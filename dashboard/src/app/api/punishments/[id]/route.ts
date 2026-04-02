
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

import { verifyPermissionOrError, verifyCsrf } from "@/lib/auth-permissions"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!verifyCsrf(req)) return new NextResponse("CSRF verification failed", { status: 403 })

    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { id } = await params

    // Verify permission - Require canBan to delete punishments (highest level mod action)
    const punishment = await prisma.punishment.findUnique({ where: { id } })
    if (!punishment) return new NextResponse("Not Found", { status: 404 })

    const error = await verifyPermissionOrError(session.user, punishment.serverId, "canBan")
    if (error) return error

    try {
        await prisma.punishment.delete({
            where: { id }
        })
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

    // Baseline permission check to edit ANY punishment details
    const baseError = await verifyPermissionOrError(session.user, punishment.serverId, "canViewPunishments")
    if (baseError) return baseError

    // Additional check if resolving a BOLO
    if (body.resolved !== undefined && punishment.type === "Ban Bolo") {
        const boloError = await verifyPermissionOrError(session.user, punishment.serverId, "canManageBolos")
        if (boloError) return boloError
    }

    try {
        const updateData: { reason?: string, resolved?: boolean } = {}
        if (body.reason !== undefined) updateData.reason = body.reason
        if (body.resolved !== undefined) updateData.resolved = body.resolved

        const updated = await prisma.punishment.update({
            where: { id },
            data: updateData
        })
        return NextResponse.json(updated)
    } catch (e) {
        console.error("Update punishment error:", e)
        return new NextResponse("Failed to update", { status: 500 })
    }
}
