
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"

// Get all members for a server
export async function GET(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { searchParams } = new URL(req.url)
        const serverId = searchParams.get("serverId")

        if (!serverId) {
            return NextResponse.json({ error: "Missing serverId" }, { status: 400 })
        }

        const hasAccess = await isServerAdmin(session.user, serverId)
        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        const members = await prisma.member.findMany({
            where: { serverId },
            include: {
                role: true
            }
        })

        // ⚡ Bolt: Optimize N+1 queries by fetching latest shifts for all members in one query
        const userIds = members.map(m => m.userId)
        const latestShifts = await prisma.shift.findMany({
            where: { serverId, userId: { in: userIds } },
            distinct: ['userId'],
            orderBy: { startTime: 'desc' },
            select: { userId: true, startTime: true, endTime: true }
        })

        const shiftsByUserId = new Map(latestShifts.map(s => [s.userId, { startTime: s.startTime, endTime: s.endTime }]))

        const membersWithShifts = members.map((m) => {
            const lastShift = shiftsByUserId.get(m.userId)
            return {
                ...m,
                shifts: lastShift ? [lastShift] : []
            }
        })

        return NextResponse.json({ members: membersWithShifts })
    } catch (e) {
        console.error("Members fetch error:", e)
        return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }
}

// Create a new member
export async function POST(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { serverId, userId, roleId } = await req.json()

        if (!serverId || !userId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        const hasAccess = await isServerAdmin(session.user, serverId)
        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        const member = await prisma.member.upsert({
            where: {
                userId_serverId: { userId, serverId }
            },
            create: {
                userId,
                serverId,
                roleId: roleId || null
            },
            update: {
                roleId: roleId || null
            }
        })

        return NextResponse.json({ success: true, member })
    } catch (e) {
        console.error("Member create error:", e)
        return NextResponse.json({ error: "Failed to create member" }, { status: 500 })
    }
}
