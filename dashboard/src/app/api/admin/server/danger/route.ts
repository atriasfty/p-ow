import { getSession } from "@/lib/auth-clerk"
import { verifyCsrf } from "@/lib/auth-permissions"
import { prisma } from "@/lib/db"
import { isServerOwner, isSuperAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"

export async function PATCH(req: Request) {
    if (!verifyCsrf(req)) return new NextResponse("Forbidden", { status: 403 })
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { serverId, action, value } = await req.json()

        if (!serverId || !action) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Only owner or superadmin can access danger zone actions
        if (!await isServerOwner(session.user as any, serverId)) {
            return new NextResponse("Forbidden: Only the server owner can perform this action", { status: 403 })
        }

        if (action === "CHANGE_API_KEY") {
            if (!value) return NextResponse.json({ error: "API Key is required" }, { status: 400 })
            
            await prisma.server.update({
                where: { id: serverId },
                data: { apiUrl: value } // Stored in 'api_key' column via @map
            })
            return NextResponse.json({ success: true, message: "API Key updated successfully" })
        }

        if (action === "TRANSFER_OWNERSHIP") {
            if (!value) return NextResponse.json({ error: "Target User ID is required" }, { status: 400 })
            
            // Verify target user is a member of this server
            const isMember = await prisma.member.findFirst({
                where: { serverId, userId: value }
            })

            if (!isMember) {
                return NextResponse.json({ error: "Target user must be a member of this server" }, { status: 400 })
            }

            await prisma.server.update({
                where: { id: serverId },
                data: { subscriberUserId: value }
            })
            return NextResponse.json({ success: true, message: "Ownership transferred successfully" })
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    } catch (e: any) {
        console.error("[SERVER DANGER PATCH]", e)
        return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    if (!verifyCsrf(req)) return new NextResponse("Forbidden", { status: 403 })
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { searchParams } = new URL(req.url)
        const serverId = searchParams.get("serverId")

        if (!serverId) {
            return NextResponse.json({ error: "Missing serverId" }, { status: 400 })
        }

        // Only owner or superadmin can delete
        if (!await isServerOwner(session.user as any, serverId)) {
            return new NextResponse("Forbidden: Only the server owner can delete this server", { status: 403 })
        }

        // Cascade delete is handled by Prisma (onDelete: Cascade)
        await prisma.server.delete({
            where: { id: serverId }
        })

        return NextResponse.json({ success: true, message: "Server deleted successfully" })
    } catch (e: any) {
        console.error("[SERVER DANGER DELETE]", e)
        return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 })
    }
}
