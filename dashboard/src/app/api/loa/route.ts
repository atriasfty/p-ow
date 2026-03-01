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
                userId: session.user.id, // Consistent with Clerk ID
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                reason,
                status: "pending"
            }
        })

        // Notify via bot queue if configured
        if (server.staffRequestChannelId) {
            const embed = {
                embeds: [
                    {
                        title: "New LOA Request",
                        color: 0xf59e0b, // Amber
                        fields: [
                            { name: "Staff Member", value: session.user.name || session.user.username || session.user.id, inline: true },
                            { name: "Start Date", value: startDate, inline: true },
                            { name: "End Date", value: endDate, inline: true },
                            { name: "Reason", value: reason, inline: false }
                        ],
                        footer: { text: `ID: ${loa.id}` },
                        timestamp: new Date().toISOString()
                    }
                ]
            }

            await prisma.botQueue.create({
                data: {
                    serverId,
                    type: "MESSAGE",
                    targetId: server.staffRequestChannelId,
                    content: JSON.stringify(embed)
                }
            })
        }

        return NextResponse.json({ success: true, id: loa.id })
    } catch (e: any) {
        console.error("[LOA POST]", e)
        return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 })
    }
}
