
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"
import { verifyCsrf } from "@/lib/auth-permissions"

// Update server settings
export async function PATCH(req: Request) {
    if (!verifyCsrf(req)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }

    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
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
            loaChannelId,
            onLoaRoleId,
            maxUploadSize,
            staffRequestRateLimit,
            logCacheTtl,
            automationCacheTtl,
            customBotToken,
            customBotEnabled
        } = await req.json()

        if (!serverId) {
            return NextResponse.json({ error: "Missing serverId" }, { status: 400 })
        }

        // Check admin access
        const hasAccess = await isServerAdmin(session.user as any, serverId)
        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        const server = await prisma.server.findUnique({ where: { id: serverId } })
        
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
                loaChannelId: loaChannelId || null,
                onLoaRoleId: onLoaRoleId || null,
                maxUploadSize: maxUploadSize || null,
                staffRequestRateLimit: staffRequestRateLimit || null,
                ...(finalBotToken !== undefined && { customBotToken: finalBotToken }),
                ...(finalBotEnabled !== undefined && { customBotEnabled: finalBotEnabled }),
            }
        })

        return NextResponse.json({ success: true, server: updated })
    } catch (e) {
        console.error("Server update error:", e)
        return NextResponse.json({ error: "Failed to update server" }, { status: 500 })
    }
}
