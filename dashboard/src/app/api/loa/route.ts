import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { verifyPermissionOrError, verifyCsrf } from "@/lib/auth-permissions"
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

        const server = await prisma.server.findUnique({
            where: { id: serverId }
        })

        if (!server) {
            return NextResponse.json({ error: "Server not found" }, { status: 404 })
        }

        // Create the LOA record
        const loa = await prisma.leaveOfAbsence.create({
            data: {
                serverId,
                userId: session.user.id,
                robloxUsername: session.user.robloxUsername || session.user.username || "Unknown",
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                reason,
                status: "pending"
            }
        })

        // Notify via bot queue if configured
        const notifyChannelId = server.loaChannelId || server.staffRequestChannelId
        if (notifyChannelId) {
            const payload = {
                embeds: [
                    {
                        title: "📅 New LOA Request",
                        color: 0x6366f1, // Indigo
                        fields: [
                            { name: "Staff Member", value: session.user.robloxUsername || session.user.username || session.user.id, inline: true },
                            { name: "Start Date", value: new Date(startDate).toLocaleDateString(), inline: true },
                            { name: "End Date", value: new Date(endDate).toLocaleDateString(), inline: true },
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
