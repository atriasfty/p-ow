import { NextRequest } from "next/server"
import { getSession } from "@/lib/auth-clerk"
import { isServerMember } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { eventBus, ServerEventType, ServerEventMap } from "@/lib/event-bus"
import { getServerSettings } from "@/lib/server-settings"
import { healthState } from "@/lib/health-state"

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

    // Load settings for this server (needed for snapshot window sizes)
    const s = await getServerSettings(serverId)

    const stream = new ReadableStream({
        async start(controller) {
            let closed = false
            let heartbeat: ReturnType<typeof setInterval> | undefined
            healthState.sseConnections++

            const cleanup = () => {
                if (closed) return
                closed = true
                healthState.sseConnections = Math.max(0, healthState.sseConnections - 1)
                clearInterval(heartbeat)
                unsubscribe()
                try { controller.close() } catch { /* already closed */ }
            }

            const enqueue = (event: string, data: unknown) => {
                if (closed) return
                try {
                    controller.enqueue(encoder.encode(sseMessage(event, data)))
                } catch {
                    // Client disconnected — trigger cleanup once
                    cleanup()
                }
            }

            // ---- Subscribe to live events FIRST, buffering until the snapshot is
            // sent ----
            // Snapshot building below runs several sequential DB queries, which takes
            // long enough for log-syncer to emit an event in the meantime. Subscribing
            // only after the snapshot queries finish would silently drop that event —
            // it's not in the snapshot (already queried) and not yet caught by a live
            // subscription. Subscribing up front and buffering closes that gap.
            let snapshotDone = false
            const buffered: { type: string; data: unknown }[] = []
            let unsubscribe: () => void = eventBus.subscribe(serverId, (type, data) => {
                if (snapshotDone) {
                    enqueue(type, data)
                } else {
                    buffered.push({ type, data })
                }
            })

            // ---- Send initial snapshot ----
            try {
                // 1. Player list (from latest player locations in DB within configured window)
                const recentLocations = await prisma.playerLocation.findMany({
                    where: {
                        serverId,
                        createdAt: { gte: new Date(Date.now() - s.ssePlayerWindowMinutes * 60 * 1000) }
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

                // Server stats are seeded from SSR props (initialPlayers/initialMaxPlayers).
                // The live log-syncer event overwrites them within ~4 seconds, so no snapshot needed here.

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
                        take: s.sseModCallSnapshotLimit
                    }),
                    prisma.emergencyCall.findMany({
                        where: { serverId },
                        orderBy: { timestamp: "desc" },
                        take: s.sseEmergencySnapshotLimit
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

                // 6. SSD check (within configured display window)
                const ssdWindowAgo = new Date(Date.now() - s.ssdDisplayDays * 24 * 60 * 60 * 1000)
                const ssdConfig = await prisma.config.findUnique({
                    where: { key: `ssd_${serverId}` }
                })
                let ssdEventData = null
                if (ssdConfig) {
                    try {
                        const parsed = JSON.parse(ssdConfig.value)
                        if (new Date(parsed.timestamp) > ssdWindowAgo) {
                            // Only show to users whose shifts were actually ended
                            const wasAffected = Array.isArray(parsed.affectedUserIds) &&
                                possibleUserIds.some(id => parsed.affectedUserIds.includes(id))

                            if (wasAffected) {
                                // Check if this user has already dismissed this specific event
                                const dismissKey = `ssd_dismissed_${serverId}_${userId}`
                                const dismissRecord = await prisma.config.findUnique({ where: { key: dismissKey } })
                                let alreadyDismissed = false
                                if (dismissRecord) {
                                    try {
                                        const d = JSON.parse(dismissRecord.value)
                                        alreadyDismissed = d.eventTimestamp === parsed.timestamp
                                    } catch { /* ignore */ }
                                }
                                if (!alreadyDismissed) ssdEventData = parsed
                            }
                        }
                    } catch { /* ignore */ }
                }
                enqueue("ssd", { ssd: ssdEventData })

            } catch (e) {
                const { trackError } = await import("@/lib/errors")
                trackError(e, { source: "sse:snapshot", serverId, userId })
            }

            // ---- Flush any live events that arrived while the snapshot was being
            // built, then switch to forwarding events directly ----
            snapshotDone = true
            for (const b of buffered) enqueue(b.type, b.data)
            buffered.length = 0

            // ---- Heartbeat — named event so the client can detect stream staleness ----
            heartbeat = setInterval(() => {
                enqueue("heartbeat", null)
            }, 8000)

            // ---- Cleanup on client disconnect ----
            req.signal.addEventListener("abort", cleanup)
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
