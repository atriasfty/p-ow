import { prisma } from "@/lib/db"
import { validatePublicApiKey, withRateLimit, resolveServer, logApiAccess } from "@/lib/public-auth"
import { getServerSettings } from "@/lib/server-settings"
import { eventBus } from "@/lib/event-bus"
import { PrcClient } from "@/lib/prc"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    const auth = await validatePublicApiKey()
    if (!auth.valid) return withRateLimit(NextResponse.json({ error: auth.error }, { status: 401 }), auth)

    const { searchParams } = new URL(req.url)
    const body = await req.json().catch(() => ({}))
    const { userId } = body

    if (!userId) return withRateLimit(NextResponse.json({ error: "Missing userId" }, { status: 400 }), auth)

    const server = await resolveServer(auth.apiKey)
    if (!server) return withRateLimit(NextResponse.json({ error: "Server not found" }, { status: 404 }), auth)

    const isMember = await prisma.member.findFirst({ where: { userId, serverId: server.id } })
    if (!isMember) return withRateLimit(NextResponse.json({ error: "User is not a member of this server" }, { status: 403 }), auth)

    // Load server settings to enforce per-server rules
    const s = await getServerSettings(server.id)

    // LOA block check
    if (s.shiftLoaBlocks) {
        const now = new Date()
        const activeLoa = await prisma.leaveOfAbsence.findFirst({
            where: {
                serverId: server.id,
                userId,
                status: 'approved',
                startDate: { lte: now },
                endDate: { gte: now }
            }
        })
        if (activeLoa) {
            return withRateLimit(NextResponse.json({
                error: "User is on an approved Leave of Absence and cannot start a shift"
            }, { status: 403 }), auth)
        }
    }

    // Max on duty check
    if (s.shiftMaxOnDuty > 0) {
        const onDutyCount = await prisma.shift.count({ where: { serverId: server.id, endTime: null } })
        if (onDutyCount >= s.shiftMaxOnDuty) {
            return withRateLimit(NextResponse.json({
                error: `Maximum staff on duty (${s.shiftMaxOnDuty}) already reached`
            }, { status: 409 }), auth)
        }
    }

    // Cooldown check
    if (s.shiftCooldownMinutes > 0) {
        const lastShift = await prisma.shift.findFirst({
            where: { userId, serverId: server.id, endTime: { not: null } },
            orderBy: { endTime: 'desc' }
        })
        if (lastShift?.endTime) {
            const cooldownMs = s.shiftCooldownMinutes * 60 * 1000
            const timeSinceEnd = Date.now() - lastShift.endTime.getTime()
            if (timeSinceEnd < cooldownMs) {
                const remainingM = Math.ceil((cooldownMs - timeSinceEnd) / 60000)
                return withRateLimit(NextResponse.json({
                    error: `Shift cooldown active — wait ${remainingM} more minute(s) before going on duty`
                }, { status: 429 }), auth)
            }
        }
    }

    // Require players in game check
    if (s.shiftRequirePlayersInGame) {
        if (!server.apiUrl) {
            return withRateLimit(NextResponse.json({ error: "Server not configured properly" }, { status: 503 }), auth)
        }
        try {
            const prcClient = new PrcClient(server.apiUrl)
            const players = await prcClient.getPlayers()
            if (players.length === 0) {
                return withRateLimit(NextResponse.json({ error: "Cannot go on duty — server has no players" }, { status: 503 }), auth)
            }
        } catch {
            return withRateLimit(NextResponse.json({ error: "Cannot go on duty — server appears to be offline" }, { status: 503 }), auth)
        }
    }

    // Use a transaction to prevent race conditions
    const shift = await prisma.$transaction(async (tx) => {
        // Find existing active shift
        const existing = await tx.shift.findFirst({
            where: { userId, serverId: server.id, endTime: null }
        })

        if (existing) {
            throw new Error("Shift already active")
        }

        return await tx.shift.create({
            data: {
                userId,
                serverId: server.id,
                startTime: new Date()
            }
        })
    }).catch((e: any) => {
        if (e.message === "Shift already active") {
            return { error: e.message }
        }
        throw e
    })

    if ('error' in shift) {
        return withRateLimit(NextResponse.json({ error: shift.error }, { status: 400 }), auth)
    }

    // Notify SSE clients (fire-and-forget)
    try {
        eventBus.emit(server.id, 'shift-status', {
            shift: { id: shift.id, startTime: shift.startTime.toISOString() }
        })
        const onDutyNow = await prisma.shift.findMany({ where: { serverId: server.id, endTime: null }, select: { userId: true } })
        eventBus.emit(server.id, 'staff-on-duty-ids', onDutyNow.map(s => s.userId))
    } catch {
        // Non-critical
    }

    await logApiAccess(auth.apiKey, "PUBLIC_SHIFT_STARTED", `User: ${userId}, Server: ${server.name}`)
    return withRateLimit(NextResponse.json({ success: true, shift }), auth)
}
