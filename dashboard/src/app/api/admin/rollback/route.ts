
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isSuperAdmin } from "@/lib/admin"
import { verifyCsrf } from "@/lib/auth-permissions"
import { NextResponse } from "next/server"
import { RollbackService } from "@/lib/rollback-service"
import { PrcClient } from "@/lib/prc"
import { getServerConfig } from "@/lib/server-config"

export async function POST(req: Request) {
    if (!verifyCsrf(req)) return new NextResponse("Forbidden", { status: 403 })
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    // Rollback runs reversal commands against the live server. Restricted to
    // server owner or superadmin — regular admins/staff cannot trigger it.
    const body = await req.json().catch(() => ({}))
    const { serverId, targetUserId, timestamp } = body

    if (typeof serverId !== "string" || typeof targetUserId !== "string" || !serverId || !targetUserId) {
        return new NextResponse("Missing serverId or targetUserId", { status: 400 })
    }

    const server = await prisma.server.findUnique({
        where: { id: serverId },
        select: { subscriberUserId: true }
    })
    if (!server) return new NextResponse("Server not found", { status: 404 })

    const isOwner = server.subscriberUserId === session.user.id
    if (!isOwner && !isSuperAdmin(session.user)) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    try {
        // 1. Determine time range. Reject malformed timestamps; clamp to a
        // sane lower bound so we can't sweep arbitrarily far back.
        let startTime: Date
        if (timestamp !== undefined && timestamp !== null) {
            const parsed = new Date(timestamp)
            if (isNaN(parsed.getTime())) {
                return new NextResponse("Invalid timestamp", { status: 400 })
            }
            const earliestAllowed = Date.now() - 7 * 24 * 60 * 60 * 1000
            if (parsed.getTime() < earliestAllowed) {
                return new NextResponse("Timestamp too far in the past (max 7 days)", { status: 400 })
            }
            startTime = parsed
        } else {
            startTime = new Date(Date.now() - 24 * 60 * 60 * 1000)
        }

        // We need to find logs where this user was the ACTOR.
        // In our Log model:
        // - type="command", playerId=targetUserId
        const logs = await prisma.log.findMany({
            where: {
                serverId,
                type: "command",
                playerId: targetUserId,
                createdAt: { gte: startTime }
            },
            orderBy: { createdAt: "desc" },
            // If explicit timestamp is given, allow more logs (up to 1000), otherwise restrict to 100
            take: timestamp ? 1000 : 100
        })

        if (logs.length === 0) {
            return NextResponse.json({ success: true, reversalsQueued: 0, message: "No logs found" })
        }

        // 2. Calculate Reversals
        const service = new RollbackService()
        // Map DB logs to the format expected by service (id, command)
        const logsForService = logs.map((l: any) => ({ id: l.id, command: l.command || "" }))
        const reversals = service.calculateReversals(logsForService)

        // 3. Execute Reversals
        if (reversals.length > 0) {
            const config = await getServerConfig(serverId)
            if (config) {
                const prc = new PrcClient(config.apiUrl)
                // Execute in small batches to respect rate limits
                for (const reversal of reversals) {
                    await prc.executeCommand(reversal.command).catch(e => {
                        console.error(`[ROLLBACK] Reversal failed: ${reversal.command}`, e)
                    })
                    // Tiny sleep between commands
                    await new Promise(r => setTimeout(r, 200))
                }
            }
        }

        // 4. Log the Rollback Action (Security Log)
        await prisma.securityLog.create({
            data: {
                event: "RAID_ROLLBACK",
                ip: "dashboard", // Internal
                creatorId: session.user.id,
                serverId,
                details: `Rolled back ${reversals.length} actions for target ${targetUserId} on server ${serverId}`
            }
        })

        return NextResponse.json({
            success: true,
            reversalsQueued: reversals.length
        })

    } catch (e: any) {
        console.error("[ROLLBACK] Error:", e)
        return NextResponse.json({ error: e.message || "Internal Error" }, { status: 500 })
    }
}
