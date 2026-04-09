
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
        const { serverId, permission, usernames, time } = await req.json()

        if (!serverId || !permission || !usernames || !time) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Permission check - require canUseToolbox
        const permError = await verifyPermissionOrError(session.user, serverId, "canUseToolbox")
        if (permError) return permError

        const server = await prisma.server.findUnique({
            where: { id: serverId }
        })

        if (!server) {
            return NextResponse.json({ error: "Server not found" }, { status: 404 })
        }

        if (!server.permLogChannelId) {
            return NextResponse.json({ error: "Perm log channel not configured for this server" }, { status: 400 })
        }

        const moderator = session.user.robloxUsername || session.user.name || session.user.username || "Unknown"

        // Create the embed payload
        const embed = {
            embeds: [
                {
                    title: "Permission Log",
                    color: 3447003, // Blue
                    fields: [
                        { name: "Permission", value: permission, inline: true },
                        { name: "Username/s", value: usernames, inline: true },
                        { name: "Time", value: time, inline: true },
                        { name: "Moderator", value: moderator, inline: false }
                    ],
                    footer: { text: server.customName || server.name },
                    timestamp: new Date().toISOString()
                }
            ]
        }

        // Add to bot queue
        await prisma.botQueue.create({
            data: {
                serverId,
                type: "MESSAGE",
                targetId: server.permLogChannelId,
                content: JSON.stringify(embed),
                status: "PENDING"
            }
        })

        // Also create a regular log entry in the dashboard - use 'command' type for consistency
        await prisma.log.create({
            data: {
                serverId,
                type: "command",
                command: `:permlog ${permission} | ${usernames} | ${time}`,
                playerName: moderator,
                playerId: session.user.robloxId || session.user.id
            }
        })

        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed to log permission" }, { status: 500 })
    }
}
