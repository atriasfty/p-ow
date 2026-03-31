
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"

// Create role
export async function POST(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const {
            serverId, name, color, quotaMinutes, discordRoleId,
            canShift, canViewOtherShifts, canViewLogs, canViewPunishments,
            canIssueWarnings, canKick, canBan, canBanBolo,
            canUseToolbox, canManageBolos, canRequestLoa, canViewQuota, canUseAdminCommands, canAccessAdmin
        } = await req.json()

        if (!serverId || !name) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        const hasAccess = await isServerAdmin(session.user, serverId)
        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        const role = await prisma.role.create({
            data: {
                serverId,
                name,
                color: color || "#6366f1",
                quotaMinutes: quotaMinutes || 0,
                discordRoleId: discordRoleId || null,
                canShift: canShift ?? true,
                canViewOtherShifts: canViewOtherShifts ?? true,
                canViewLogs: canViewLogs ?? true,
                canViewPunishments: canViewPunishments ?? true,
                canIssueWarnings: canIssueWarnings ?? true,
                canKick: canKick ?? true,
                canBan: canBan ?? true,
                canBanBolo: canBanBolo ?? true,
                canUseToolbox: canUseToolbox ?? true,
                canManageBolos: canManageBolos ?? true,
                canRequestLoa: canRequestLoa ?? true,
                canViewQuota: canViewQuota ?? true,
                canUseAdminCommands: canUseAdminCommands ?? false,
                canAccessAdmin: canAccessAdmin ?? false
            }
        })

        return NextResponse.json({ success: true, role })
    } catch (e) {
        console.error("Create role error:", e)
        return NextResponse.json({ error: "Failed to create role" }, { status: 500 })
    }
}

// Update role
export async function PATCH(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const {
            roleId, name, color, quotaMinutes, discordRoleId,
            canShift, canViewOtherShifts, canViewLogs, canViewPunishments,
            canIssueWarnings, canKick, canBan, canBanBolo,
            canUseToolbox, canManageBolos, canRequestLoa, canViewQuota, canUseAdminCommands, canAccessAdmin
        } = await req.json()

        if (!roleId) {
            return NextResponse.json({ error: "Missing roleId" }, { status: 400 })
        }

        const role = await prisma.role.findUnique({ where: { id: roleId } })
        if (!role) {
            return NextResponse.json({ error: "Role not found" }, { status: 404 })
        }

        const hasAccess = await isServerAdmin(session.user, role.serverId)
        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        const updated = await prisma.role.update({
            where: { id: roleId },
            data: {
                name,
                color,
                quotaMinutes,
                discordRoleId: discordRoleId || null,
                canShift,
                canViewOtherShifts,
                canViewLogs,
                canViewPunishments,
                canIssueWarnings,
                canKick,
                canBan,
                canBanBolo,
                canUseToolbox,
                canManageBolos,
                canRequestLoa,
                canViewQuota,
                canUseAdminCommands,
                canAccessAdmin
            }
        })

        return NextResponse.json({ success: true, role: updated })
    } catch (e) {
        console.error("Update role error:", e)
        return NextResponse.json({ error: "Failed to update role" }, { status: 500 })
    }
}

// Delete role
export async function DELETE(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { roleId } = await req.json()

        if (!roleId) {
            return NextResponse.json({ error: "Missing roleId" }, { status: 400 })
        }

        const role = await prisma.role.findUnique({ where: { id: roleId } })
        if (!role) {
            return NextResponse.json({ error: "Role not found" }, { status: 404 })
        }

        const hasAccess = await isServerAdmin(session.user, role.serverId)
        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        // Don't allow deleting default role
        if (role.isDefault) {
            return NextResponse.json({ error: "Cannot delete default role" }, { status: 400 })
        }

        await prisma.role.delete({ where: { id: roleId } })

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error("Delete role error:", e)
        return NextResponse.json({ error: "Failed to delete role" }, { status: 500 })
    }
}
