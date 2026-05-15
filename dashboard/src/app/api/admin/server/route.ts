
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

        // Only write fields that were explicitly included in the request body.
        // Unconditional writes were silently nulling out fields (including
        // discordGuildId) when callers PATCHed a partial body, bypassing
        // the owner-only gate above.
        const updated = await prisma.server.update({
            where: { id: serverId },
            data: {
                ...(customName !== undefined && { customName: customName || null }),
                ...(bannerUrl !== undefined && { bannerUrl: bannerUrl || null }),
                ...(onDutyRoleId !== undefined && { onDutyRoleId: onDutyRoleId || null }),
                ...(discordGuildId !== undefined && { discordGuildId: discordGuildId || null }),
                ...(autoSyncRoles !== undefined && { autoSyncRoles: autoSyncRoles ?? false }),
                ...(suspendedRoleId !== undefined && { suspendedRoleId: suspendedRoleId || null }),
                ...(terminatedRoleId !== undefined && { terminatedRoleId: terminatedRoleId || null }),
                ...(staffRoleId !== undefined && { staffRoleId: staffRoleId || null }),
                ...(permLogChannelId !== undefined && { permLogChannelId: permLogChannelId || null }),
                ...(staffRequestChannelId !== undefined && { staffRequestChannelId: staffRequestChannelId || null }),
                ...(commandLogChannelId !== undefined && { commandLogChannelId: commandLogChannelId || null }),
                ...(raidAlertChannelId !== undefined && { raidAlertChannelId: raidAlertChannelId || null }),
                ...(milestoneChannelId !== undefined && { milestoneChannelId: milestoneChannelId || null }),
                ...(loaChannelId !== undefined && { loaChannelId: loaChannelId || null }),
                ...(onLoaRoleId !== undefined && { onLoaRoleId: onLoaRoleId || null }),
                ...(staffRequestRateLimit !== undefined && { staffRequestRateLimit: staffRequestRateLimit || null }),
                ...(finalBotToken !== undefined && { customBotToken: finalBotToken }),
                ...(finalBotEnabled !== undefined && { customBotEnabled: finalBotEnabled }),
                ...(featureLoa !== undefined && { featureLoa }),
                ...(featureStaffReq !== undefined && { featureStaffReq }),
                ...(featurePermLog !== undefined && { featurePermLog }),
                ...(webhookUrl !== undefined && { webhookUrl: webhookUrl || null }),
                ...(webhookEvents !== undefined && { webhookEvents: Array.isArray(webhookEvents) ? JSON.stringify(webhookEvents) : (webhookEvents || null) }),
                ...(webhookEnabled !== undefined && { webhookEnabled }),
                ...(webhookPublicKey !== undefined && { webhookPublicKey: webhookPublicKey || null }),
            },
            // Never return sensitive credentials in the response
            select: {
                id: true,
                name: true,
                customName: true,
                bannerUrl: true,
                discordGuildId: true,
                onDutyRoleId: true,
                autoSyncRoles: true,
                suspendedRoleId: true,
                terminatedRoleId: true,
                staffRoleId: true,
                permLogChannelId: true,
                staffRequestChannelId: true,
                commandLogChannelId: true,
                raidAlertChannelId: true,
                milestoneChannelId: true,
                loaChannelId: true,
                onLoaRoleId: true,
                staffRequestRateLimit: true,
                customBotEnabled: true,
                featureLoa: true,
                featureStaffReq: true,
                featurePermLog: true,
                webhookEnabled: true,
                webhookEvents: true,
                webhookPublicKey: true,
                subscriptionPlan: true,
                createdAt: true,
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
