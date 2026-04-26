import { prisma } from "@/lib/db"
import { eventBus } from "@/lib/event-bus"
import { NextResponse } from "next/server"
import crypto from "crypto"

const INTERNAL_SECRET = process.env.INTERNAL_SYNC_SECRET!

/**
 * POST /api/internal/shift-event
 *
 * Called by the Discord bot after it starts or ends a shift so that the mod
 * panel's "on duty" list updates in real time without waiting for the next
 * sync cycle.
 *
 * Body: { serverId: string, action: "start" | "end", userId: string }
 *
 * Auth: x-internal-secret header (same shared secret as /api/internal/sync).
 */
export async function POST(req: Request) {
    const authHeader = req.headers.get("x-internal-secret")

    if (
        !authHeader ||
        authHeader.length !== INTERNAL_SECRET.length ||
        !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(INTERNAL_SECRET))
    ) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    try {
        const body = await req.json().catch(() => ({}))
        const { serverId, action, userId } = body as {
            serverId?: string
            action?: "start" | "end"
            userId?: string
        }

        if (!serverId || !action || !userId) {
            return NextResponse.json({ error: "Missing serverId, action, or userId" }, { status: 400 })
        }

        // Fetch current on-duty user IDs
        const onDutyShifts = await prisma.shift.findMany({
            where: { serverId, endTime: null },
            select: { userId: true }
        })
        const onDutyIds = onDutyShifts.map(s => s.userId)

        // Broadcast updated staff list to all mod panel clients
        eventBus.emit(serverId, "staff-on-duty-ids", onDutyIds)

        // Also broadcast this user's personal shift status so their own panel updates
        if (action === "start") {
            const activeShift = await prisma.shift.findFirst({
                where: { serverId, userId, endTime: null },
                select: { id: true, startTime: true }
            })
            if (activeShift) {
                eventBus.emit(serverId, "shift-status", {
                    shift: { id: activeShift.id, startTime: activeShift.startTime.toISOString() }
                })
            }
        } else {
            eventBus.emit(serverId, "shift-status", { shift: null })
        }

        return NextResponse.json({ ok: true, onDutyCount: onDutyIds.length })
    } catch (e) {
        console.error("[SHIFT-EVENT]", e)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
