import { NextRequest } from "next/server"
import { getSession } from "@/lib/auth-clerk"
import { isServerMember } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { eventBus, ServerEventType, ServerEventMap } from "@/lib/event-bus"

// Tell Next.js to always run this route dynamically (never statically render it)
export const dynamic = "force-dynamic"

// Helper to format SSE messages
function sseMessage(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const session = await getSession()
    if (!session) {
        return new Response("Unauthorized", { status: 401 })
    }

    const { serverId } = await params

    if (!(await isServerMember(session.user as any, serverId))) {
        return new Response("Forbidden", { status: 403 })
    }

    const encoder = new TextEncoder()

    // Build initial snapshot of current state
    const userId = session.user.id
    const possibleUserIds = [
        session.user.discordId,
        session.user.id,
        session.user.robloxId
    ].filter((id): id is string => !!id)

    const stream = new ReadableStream({
        async start(controller) {
            const enqueue = (event: string, data: unknown) => {
                try {
                    controller.enqueue(encoder.encode(sseMessage(event, data)))
                } catch {
                    // Client disconnected
                }
            }

            // ---- Send initial snapshot ----
            try {
                // 1. Player list (from latest player locations in DB within last 2 minutes)
                const recentLocations = await prisma.playerLocation.findMany({
                    where: {
                        serverId,
                        createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) }
                    },
                    orderBy: { createdAt: "desc" },
                    distinct: ["userId"]
                })
                if (recentLocations.length > 0) {
                    const players = recentLocations.map(loc => ({
                        id: loc.userId,
                        name: loc.playerName || "Unknown",
                        location: {
                            x: loc.locationX,
                            z: loc.locationZ,
                            postal: loc.postalCode,
                            street: loc.streetName,
                            building: loc.buildingNumber
                        }
                    }))
                    enqueue("players", players)
                }

                // 2. Server stats (from server record + recent player count)
                const server = await prisma.server.findUnique({ where: { id: serverId } })
                if (server) {
                    enqueue("server-stats", {
                        players: recentLocations.length,
                        maxPlayers: 0, // Will be overwritten on next sync
                        online: recentLocations.length > 0
                    })
                }

                // 3. Current shift status
                const activeShift = await prisma.shift.findFirst({
                    where: {
                        userId: { in: possibleUserIds },
                        serverId,
                        endTime: null
                    }
                })
                enqueue("shift-status", {
                    shift: activeShift ? {
                        id: activeShift.id,
                        startTime: activeShift.startTime.toISOString()
                    } : null
                })

                // 4. Recent calls (mod + emergency)
                const [modCalls, emergencyCalls] = await Promise.all([
                    prisma.modCall.findMany({
                        where: { serverId },
                        orderBy: { timestamp: "desc" },
                        take: 50
                    }),
                    prisma.emergencyCall.findMany({
                        where: { serverId },
                        orderBy: { timestamp: "desc" },
                        take: 50
                    })
                ])
                enqueue("calls", { modCalls, emergencyCalls })

                // 5. Staff on duty
                const onDutyShifts = await prisma.shift.findMany({
                    where: { serverId, endTime: null },
                    orderBy: { startTime: "asc" }
                })
                const staffIds = onDutyShifts.map(s => s.userId)
                // Emit a basic on-duty event the component can hydrate
                enqueue("staff-on-duty-ids", staffIds)

                // 6. SSD check
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                const ssdConfig = await prisma.config.findUnique({
                    where: { key: `ssd:${serverId}` }
                })
                let ssdEventData = null
                if (ssdConfig) {
                    try {
                        const parsed = JSON.parse(ssdConfig.value)
                        if (new Date(parsed.timestamp) > sevenDaysAgo) {
                            ssdEventData = parsed
                        }
                    } catch { /* ignore */ }
                }
                enqueue("ssd", { ssd: ssdEventData })

            } catch (e) {
                console.error("[SSE] Snapshot error:", e)
            }

            // ---- Subscribe to live events ----
            const unsubscribe = eventBus.subscribe(serverId, (type, data) => {
                enqueue(type, data)
            })

            // ---- Heartbeat to prevent proxy timeouts (every 25 seconds) ----
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(": heartbeat\n\n"))
                } catch {
                    clearInterval(heartbeat)
                    unsubscribe()
                }
            }, 25000)

            // ---- Cleanup on client disconnect ----
            req.signal.addEventListener("abort", () => {
                clearInterval(heartbeat)
                unsubscribe()
                try { controller.close() } catch { /* already closed */ }
            })
        }
    })

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no", // Disable Nginx buffering
        }
    })
}
