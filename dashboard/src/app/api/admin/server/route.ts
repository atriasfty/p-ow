
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin, SUPER_ADMIN_ID } from "@/lib/admin"
import { NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"
import { verifyCsrf } from "@/lib/auth-permissions"

// Update server settings
export async function PATCH(req: Request) {
    if (!verifyCsrf(req)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }

    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const body = await req.json()
        const {
            serverId,
            customName,
            bannerUrl,
            onDutyRoleId,
            discordGuildId,
            autoSyncRoles,
            suspendedRoleId,
            terminatedRoleId,
            staffRoleId,
            permLogChannelId,
            staffRequestChannelId,
            commandLogChannelId,
            raidAlertChannelId,
            milestoneChannelId,
            loaChannelId,
            onLoaRoleId,
            staffRequestRateLimit,
            customBotToken,
            customBotEnabled,
            featureLoa,
            featureStaffReq,
            featurePermLog,
            webhookUrl,
            webhookEvents,
            webhookEnabled,
            webhookPublicKey
        } = body

        if (!serverId) {
            return NextResponse.json({ error: "Missing serverId" }, { status: 400 })
        }

        // Check admin access
        const hasAccess = await isServerAdmin(session.user as any, serverId)
        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        const server = await prisma.server.findUnique({ where: { id: serverId } })

        // discordGuildId changes are restricted to the server owner or superadmin.
        // Any other admin changing this would redirect role-sync to an attacker-controlled
        // Discord guild, granting them permanent admin access.
        if (discordGuildId !== undefined) {
            const isOwner = server?.subscriberUserId === session.user.id
            const isSuperAdmin = session.user.id === SUPER_ADMIN_ID
            if (!isOwner && !isSuperAdmin) {
                return NextResponse.json({ error: "Only the server owner can change the Discord guild ID" }, { status: 403 })
            }
        }

        let finalBotToken = undefined
        let finalBotEnabled = undefined

        if (customBotToken !== undefined || customBotEnabled !== undefined) {
            if (server?.subscriptionPlan === 'pow-max') {
                if (customBotToken !== undefined) finalBotToken = customBotToken || null
                if (customBotEnabled !== undefined) finalBotEnabled = customBotEnabled
            } else {
                return NextResponse.json({ error: "White Label Bot requires POW Max subscription" }, { status: 403 })
            }
        }

        const updated = await prisma.server.update({
            where: { id: serverId },
            data: {
                customName: customName || null,
                bannerUrl: bannerUrl || null,
                onDutyRoleId: onDutyRoleId || null,
                discordGuildId: discordGuildId || null,
                autoSyncRoles: autoSyncRoles ?? false,
                suspendedRoleId: suspendedRoleId || null,
                terminatedRoleId: terminatedRoleId || null,
                staffRoleId: staffRoleId || null,
                permLogChannelId: permLogChannelId || null,
                staffRequestChannelId: staffRequestChannelId || null,
                commandLogChannelId: commandLogChannelId || null,
                raidAlertChannelId: raidAlertChannelId || null,
                milestoneChannelId: milestoneChannelId || null,
                loaChannelId: loaChannelId || null,
                onLoaRoleId: onLoaRoleId || null,
                staffRequestRateLimit: staffRequestRateLimit || null,
                ...(finalBotEnabled !== undefined && { customBotEnabled: finalBotEnabled }),
                ...(featureLoa !== undefined && { featureLoa }),
                ...(featureStaffReq !== undefined && { featureStaffReq }),
                ...(featurePermLog !== undefined && { featurePermLog }),
                ...(webhookUrl !== undefined && { webhookUrl: webhookUrl || null }),
                ...(webhookEvents !== undefined && { webhookEvents: Array.isArray(webhookEvents) ? JSON.stringify(webhookEvents) : (webhookEvents || null) }),
                ...(webhookEnabled !== undefined && { webhookEnabled }),
                ...(webhookPublicKey !== undefined && { webhookPublicKey: webhookPublicKey || null }),
            }
        })

        // Log the action
        const changedFields = Object.keys(body).filter(k => k !== 'serverId').join(", ")
        await logAudit(
            serverId,
            "SETTINGS_UPDATED",
            `Updated server settings: ${changedFields}`,
            "DASHBOARD",
            session.user.id
        )

        return NextResponse.json({ success: true, server: updated })
    } catch (e) {
        console.error("Server update error:", e)
        return NextResponse.json({ error: "Failed to update server" }, { status: 500 })
    }
}
