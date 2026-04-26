import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { AutomationEngine } from "@/lib/automation-engine"
import { verifyCsrf } from "@/lib/auth-permissions"
import { getServerSettings } from "@/lib/server-settings"
import { NextResponse } from "next/server"
import { eventBus } from "@/lib/event-bus"

// POST /api/shifts/toggle - START a shift
export async function POST(req: Request) {
    if (!verifyCsrf(req)) return new NextResponse("Forbidden", { status: 403 })
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { serverId } = await req.json()
        if (!serverId) return NextResponse.json({ error: "Missing serverId" }, { status: 400 })

        // Ensure user has permission to shift on this server
        const { verifyPermissionOrError } = await import("@/lib/auth-permissions")
        const permError = await verifyPermissionOrError(session.user, serverId, "canShift")
        if (permError) return permError

        const s = await getServerSettings(serverId)

        // LOA block check
        if (s.shiftLoaBlocks) {
            const now = new Date()
            const activeLoa = await prisma.leaveOfAbsence.findFirst({
                where: {
                    serverId,
                    userId: session.user.id,
                    status: 'approved',
                    startDate: { lte: now },
                    endDate: { gte: now }
                }
            })
            if (activeLoa) {
                return NextResponse.json({
                    error: "You are on an approved Leave of Absence and cannot start a shift"
                }, { status: 403 })
            }
        }

        // Max on duty check
        if (s.shiftMaxOnDuty > 0) {
            const onDutyCount = await prisma.shift.count({ where: { serverId, endTime: null } })
            if (onDutyCount >= s.shiftMaxOnDuty) {
                return NextResponse.json({
                    error: `Maximum staff on duty (${s.shiftMaxOnDuty}) already reached`
                }, { status: 409 })
            }
        }

        // Cooldown check
        if (s.shiftCooldownMinutes > 0) {
            const lastShift = await prisma.shift.findFirst({
                where: { userId: session.user.id, serverId, endTime: { not: null } },
                orderBy: { endTime: 'desc' }
            })
            if (lastShift?.endTime) {
                const cooldownMs = s.shiftCooldownMinutes * 60 * 1000
                const timeSinceEnd = Date.now() - lastShift.endTime.getTime()
                if (timeSinceEnd < cooldownMs) {
                    const remainingM = Math.ceil((cooldownMs - timeSinceEnd) / 60000)
                    return NextResponse.json({
                        error: `Shift cooldown active — wait ${remainingM} more minute(s) before going on duty`
                    }, { status: 429 })
                }
            }
        }

        // Ensure user doesn't already have an active shift on this server
        const existing = await prisma.shift.findFirst({
            where: {
                userId: session.user.id,
                serverId,
                endTime: null
            }
        })

        if (existing) return NextResponse.json({ error: "Shift already active" }, { status: 400 })

        const shift = await prisma.shift.create({
            data: {
                userId: session.user.id,
                serverId,
                startTime: new Date()
            }
        })

        // Trigger Automation
        await AutomationEngine.trigger("SHIFT_START", {
            serverId,
            player: { name: session.user.name || session.user.username || "Unknown", id: session.user.id }
        })

        // Notify SSE clients of shift start
        eventBus.emit(serverId, 'shift-status', {
            shift: { id: shift.id, startTime: shift.startTime.toISOString() }
        })
        // Update on-duty staff IDs
        const onDutyNow = await prisma.shift.findMany({ where: { serverId, endTime: null }, select: { userId: true } })
        eventBus.emit(serverId, 'staff-on-duty-ids', onDutyNow.map(s => s.userId))

        return NextResponse.json(shift)
    } catch (e) {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// PATCH /api/shifts/toggle - END a shift
export async function PATCH(req: Request) {
    if (!verifyCsrf(req)) return new NextResponse("Forbidden", { status: 403 })
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { serverId } = await req.json()
        if (!serverId) return NextResponse.json({ error: "Missing serverId" }, { status: 400 })

        const activeShift = await prisma.shift.findFirst({
            where: {
                userId: session.user.id,
                serverId,
                endTime: null
            }
        })

        if (!activeShift) return NextResponse.json({ error: "No active shift found" }, { status: 404 })

        const endTime = new Date()
        const duration = Math.floor((endTime.getTime() - activeShift.startTime.getTime()) / 1000)

        const updated = await prisma.shift.update({
            where: { id: activeShift.id },
            data: {
                endTime,
                duration
            }
        })

        // Check for milestones
        const { processMilestones } = await import("@/lib/milestones")
        await processMilestones(session.user.id, serverId)

        // Trigger Automation
        await AutomationEngine.trigger("SHIFT_END", {
            serverId,
            player: { name: session.user.name || session.user.username || "Unknown", id: session.user.id },
            details: { duration }
        })

        // Notify SSE clients of shift end
        eventBus.emit(serverId, 'shift-status', { shift: null })
        // Update on-duty staff IDs
        const onDutyNow = await prisma.shift.findMany({ where: { serverId, endTime: null }, select: { userId: true } })
        eventBus.emit(serverId, 'staff-on-duty-ids', onDutyNow.map(s => s.userId))

        return NextResponse.json(updated)
    } catch (e) {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
