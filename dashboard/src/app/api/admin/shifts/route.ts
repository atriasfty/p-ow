import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth-clerk"
import { isServerAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { findMemberByRobloxId } from "@/lib/clerk-lookup"
import { getServerSettings } from "@/lib/server-settings"

// GET - Get shifts for a user within current quota week
export async function GET(req: NextRequest) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")
    const robloxUserId = searchParams.get("userId") // Roblox user ID from player panel

    if (!serverId || !robloxUserId) {
        return new NextResponse("Missing serverId or userId", { status: 400 })
    }

    // Check admin access
    const isAdmin = await isServerAdmin(session.user, serverId)
    if (!isAdmin) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    // Use Clerk lookup to find all possible userIds for this Roblox user
    const [{ possibleUserIds, member }, s] = await Promise.all([
        findMemberByRobloxId(serverId, robloxUserId),
        getServerSettings(serverId)
    ])

    // Ensure the actual member userId is included (crucial if they were logged with an alternative ID)
    if (member && !possibleUserIds.includes(member.userId)) {
        possibleUserIds.push(member.userId)
    }

    // Calculate week start using configured week start day and timezone
    const weekStart = getWeekStart(s.quotaWeekStartDay, s.quotaTimezone)

    console.log(`[ADMIN-SHIFTS] Looking for shifts with userIds: ${possibleUserIds.join(", ")} in server ${serverId}`)

    // Get shifts for any of these user IDs within the current week, for this server
    const shifts = await prisma.shift.findMany({
        where: {
            serverId,
            userId: { in: possibleUserIds },
            startTime: { gte: weekStart }
        },
        orderBy: { startTime: "desc" }
    })

    // Also get active shift for this server
    const activeShift = await prisma.shift.findFirst({
        where: {
            serverId,
            userId: { in: possibleUserIds },
            endTime: null
        }
    })

    console.log(`[ADMIN-SHIFTS] Found ${shifts.length} shifts, activeShift: ${activeShift ? "yes" : "no"}`)

    return NextResponse.json({
        shifts,
        activeShift,
        weekStart: weekStart.toISOString()
    })
}

// POST - End a user's active shift
export async function POST(req: NextRequest) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const body = await req.json()
    const { serverId, userId: robloxUserId, shiftId } = body

    if (!serverId || !robloxUserId) {
        return new NextResponse("Missing serverId or userId", { status: 400 })
    }

    // Check admin access
    const isAdmin = await isServerAdmin(session.user, serverId)
    if (!isAdmin) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    // Use Clerk lookup to find all possible userIds
    const { possibleUserIds } = await findMemberByRobloxId(serverId, robloxUserId)

    // Find active shift
    const activeShift = shiftId
        ? await prisma.shift.findUnique({ where: { id: shiftId } })
        : await prisma.shift.findFirst({
            where: {
                serverId,
                userId: { in: possibleUserIds },
                endTime: null
            }
        })

    if (!activeShift) {
        return new NextResponse("No active shift found", { status: 404 })
    }

    if (activeShift.serverId !== serverId) {
        return new NextResponse("Forbidden - Shift belongs to another server", { status: 403 })
    }

    // End the shift
    const endTime = new Date()
    const duration = Math.floor((endTime.getTime() - activeShift.startTime.getTime()) / 1000)

    const updatedShift = await prisma.shift.update({
        where: { id: activeShift.id },
        data: {
            endTime,
            duration
        }
    })

    // Check for milestones (for the user who was on shift)
    const { processMilestones } = await import("@/lib/milestones")
    await processMilestones(activeShift.userId, serverId)

    return NextResponse.json({
        message: "Shift ended",
        shift: updatedShift
    })
}

// DELETE - Delete a specific shift
export async function DELETE(req: NextRequest) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")
    const shiftId = searchParams.get("shiftId")

    if (!serverId || !shiftId) {
        return new NextResponse("Missing serverId or shiftId", { status: 400 })
    }

    // Check admin access
    const isAdmin = await isServerAdmin(session.user, serverId)
    if (!isAdmin) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    // Verify shift exists
    const shift = await prisma.shift.findUnique({ where: { id: shiftId } })
    if (!shift) {
        return new NextResponse("Shift not found", { status: 404 })
    }

    if (shift.serverId !== serverId) {
        return new NextResponse("Forbidden - Shift belongs to another server", { status: 403 })
    }

    // Delete the shift
    await prisma.shift.delete({ where: { id: shiftId } })

    return NextResponse.json({ message: "Shift deleted", shiftId })
}

/**
 * Calculate the start of the current quota week using configured day and timezone.
 * Falls back to Monday UTC if the timezone is invalid.
 */
function getWeekStart(weekStartDay: number, timezone: string): Date {
    const now = new Date()
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'short',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        })
        const parts = formatter.formatToParts(now)
        const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
        const weekdayStr = parts.find(p => p.type === 'weekday')?.value || 'Mon'
        const currentDayOfWeek = weekdayMap[weekdayStr] ?? now.getDay()
        const diff = (currentDayOfWeek - weekStartDay + 7) % 7
        const startDate = new Date(now)
        startDate.setDate(now.getDate() - diff)
        startDate.setHours(0, 0, 0, 0)
        return startDate
    } catch {
        // Fallback: Monday UTC
        const day = now.getDay()
        const diff = now.getDate() - day + (day === 0 ? -6 : 1)
        const weekStart = new Date(now)
        weekStart.setDate(diff)
        weekStart.setHours(0, 0, 0, 0)
        return weekStart
    }
}
