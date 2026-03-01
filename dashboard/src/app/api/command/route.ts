
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { PrcClient } from "@/lib/prc"
import { getUserPermissions } from "@/lib/admin"
import { verifyPermissionOrError, verifyCsrf } from "@/lib/auth-permissions"
import { withMetrics } from "@/lib/api-metrics"
import { NextResponse } from "next/server"

export const POST = withMetrics("/api/command", async (req: Request) => {
    // 0. Verify CSRF
    if (!verifyCsrf(req)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }

    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { serverId, command } = await req.json()

        if (!serverId || !command) {
            return NextResponse.json({ error: "Missing serverId or command" }, { status: 400 })
        }

        // Permission check - require canUseToolbox
        const permissions = await getUserPermissions(session.user, serverId)
        if (!permissions.canUseToolbox) {
            return new NextResponse("Forbidden: Missing Permission canUseToolbox", { status: 403 })
        }

        // Restricted commands check
        const restrictedPrefixes = [":mod", ":unmod", ":admin", ":unadmin"]
        const lowerCommand = command.toLowerCase().trim()
        const isRestricted = restrictedPrefixes.some(p => lowerCommand.startsWith(p))

        if (isRestricted && !permissions.canUseAdminCommands) {
            return NextResponse.json({
                error: "You do not have permission to use admin commands (:mod, :admin, etc.)"
            }, { status: 403 })
        }

        const server = await prisma.server.findUnique({ where: { id: serverId } })
        if (!server) {
            return NextResponse.json({ error: "Server not found" }, { status: 404 })
        }

        const client = new PrcClient(server.apiUrl)
        await client.executeCommand(command)

        // Log to Discord if a channel is configured
        if (server.commandLogChannelId) {
            const moderatorName = session.user.robloxUsername || session.user.name || session.user.username || "Unknown"
            await prisma.botQueue.create({
                data: {
                    serverId,
                    type: "MESSAGE",
                    targetId: server.commandLogChannelId,
                    content: `**[Command Log]** \`${moderatorName}\` ran: \`${command}\``,
                    status: "PENDING"
                }
            })
        }

        return NextResponse.json({ success: true })
    } catch (e: any) {
        const msg = e.message || "Failed to execute command"
        // PRC-specific errors → 422 (not our fault, PRC is down/slow)
        if (msg.includes("PRC API Timeout") || msg.includes("Rate Limited") || msg.includes("ECONNRESET")) {
            return NextResponse.json({ error: "PRC API is currently unavailable. The game server may be offline or the API is experiencing issues. Try again in a moment." }, { status: 422 })
        }
        if (msg.includes("Invalid API Key")) {
            return NextResponse.json({ error: "Invalid PRC API key. Please check your server settings." }, { status: 403 })
        }
        return NextResponse.json({ error: msg }, { status: 500 })
    }
})
