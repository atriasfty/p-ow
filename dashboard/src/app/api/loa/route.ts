import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { AutomationEngine } from "@/lib/automation-engine"
import { verifyPermissionOrError, verifyCsrf } from "@/lib/auth-permissions"
import { getServerSettings } from "@/lib/server-settings"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    if (!verifyCsrf(req)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { serverId, startDate, endDate, reason } = await req.json()

        if (!serverId || !startDate || !endDate || !reason) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Permission check - require canRequestLoa
        const permError = await verifyPermissionOrError(session.user, serverId, "canRequestLoa")
        if (permError) return permError

        const [server, s] = await Promise.all([
            prisma.server.findUnique({ where: { id: serverId } }),
            getServerSettings(serverId)
        ])

        if (!server) {
            return NextResponse.json({ error: "Server not found" }, { status: 404 })
        }

        const start = new Date(startDate)
        const end = new Date(endDate)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Validate max duration
        if (s.loaMaxDurationDays > 0) {
            const durationDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
            if (durationDays > s.loaMaxDurationDays) {
                return NextResponse.json({
                    error: `LOA duration cannot exceed ${s.loaMaxDurationDays} days`
                }, { status: 400 })
            }
        }

        // Validate minimum notice
        if (s.loaMinNoticeDays > 0) {
            const noticeDays = Math.ceil((start.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
            if (noticeDays < s.loaMinNoticeDays) {
                return NextResponse.json({
                    error: `LOA must be submitted at least ${s.loaMinNoticeDays} day(s) in advance`
                }, { status: 400 })
            }
        }

        // Validate max pending per member
        if (s.loaMaxPendingPerMember > 0) {
            const pendingCount = await prisma.leaveOfAbsence.count({
                where: { serverId, userId: session.user.id, status: "pending" }
            })
            if (pendingCount >= s.loaMaxPendingPerMember) {
                return NextResponse.json({
                    error: `You already have ${pendingCount} pending LOA request(s) (max ${s.loaMaxPendingPerMember})`
                }, { status: 400 })
            }
        }

        // Create the LOA record
        const loa = await prisma.leaveOfAbsence.create({
            data: {
                serverId,
                userId: session.user.id,
                robloxUsername: session.user.robloxUsername || session.user.username || "Unknown",
                startDate: start,
                endDate: end,
                reason,
                status: "pending"
            }
        })

        // Trigger Automation/Webhook
        await AutomationEngine.trigger("LOA_REQUESTED" as any, {
            serverId,
            player: {
                name: loa.robloxUsername || "Unknown",
                id: session.user.id
            },
            details: { reason: loa.reason, startDate: loa.startDate, endDate: loa.endDate }
        })

        // Notify via bot queue if configured
        const notifyChannelId = server.loaChannelId || (s.loaFallbackToStaffChannel ? server.staffRequestChannelId : null)
        if (notifyChannelId) {
            const payload = {
                embeds: [
                    {
                        title: "📅 New LOA Request",
                        color: s.loaEmbedColor,
                        fields: [
                            { name: "Staff Member", value: session.user.robloxUsername || session.user.username || session.user.id, inline: true },
                            { name: "Start Date", value: start.toLocaleDateString(), inline: true },
                            { name: "End Date", value: end.toLocaleDateString(), inline: true },
                            { name: "Reason", value: reason, inline: false }
                        ],
                        footer: { text: `LOA ID: ${loa.id} • Clerk ID: ${session.user.id}` },
                        timestamp: new Date().toISOString()
                    }
                ],
                components: [
                    {
                        type: 1, // Action Row
                        components: [
                            {
                                type: 2, // Button
                                style: 3, // Success (Green)
                                label: "Accept",
                                custom_id: `loa_accept:${loa.id}`
                            },
                            {
                                type: 2, // Button
                                style: 4, // Danger (Red)
                                label: "Deny",
                                custom_id: `loa_deny:${loa.id}`
                            }
                        ]
                    }
                ]
            }

            await prisma.botQueue.create({
                data: {
                    serverId,
                    type: "MESSAGE",
                    targetId: notifyChannelId,
                    content: JSON.stringify(payload)
                }
            })
        }

        return NextResponse.json({ success: true, id: loa.id })
    } catch (e: any) {
        console.error("[LOA POST]", e)
        return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 })
    }
}
