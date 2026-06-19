import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerMember } from "@/lib/admin"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")

    if (!serverId) return new NextResponse("Missing serverId", { status: 400 })

    if (!(await isServerMember(session.user as any, serverId))) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    try {
        // Fetch last 50 calls of each type
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

        // Fallback location logic: if positionDescriptor is missing, try to find a recent location for that player
        // ⚡ Bolt: Prevent N+1 queries by batching location lookups for all calls
        const allCalls = [...modCalls, ...emergencyCalls]
        const callsNeedingLoc = allCalls.filter(c => !c.positionDescriptor && c.timestamp)

        const locationsByUserId = new Map<string, any[]>()

        if (callsNeedingLoc.length > 0) {
            const minTs = Math.min(...callsNeedingLoc.map(c => c.timestamp!))
            const maxTs = Math.max(...callsNeedingLoc.map(c => c.timestamp!))
            const userIds = Array.from(new Set(callsNeedingLoc.map(c => c.callerId)))

            // Fetch a window of locations. Bound by gte/lte to avoid pulling excessive history.
            const locs = await prisma.playerLocation.findMany({
                where: {
                    serverId,
                    userId: { in: userIds },
                    createdAt: {
                        gte: new Date(minTs * 1000 - 120000), // Up to 2 mins before earliest call
                        lte: new Date(maxTs * 1000 + 30000)   // Up to 30s after latest call
                    }
                },
                orderBy: { createdAt: "desc" }
            })

            for (const loc of locs) {
                if (!locationsByUserId.has(loc.userId)) locationsByUserId.set(loc.userId, [])
                locationsByUserId.get(loc.userId)!.push(loc)
            }
        }

        const attachLoc = (call: any) => {
            if (call.positionDescriptor || !call.timestamp) return call
            const userLocs = locationsByUserId.get(call.callerId) || []
            const targetTime = call.timestamp * 1000 + 30000

            // Find the first (most recent) location before the target time window
            const recentLoc = userLocs.find(loc => loc.createdAt.getTime() <= targetTime)

            if (recentLoc && (recentLoc.postalCode || recentLoc.streetName)) {
                return {
                    ...call,
                    positionDescriptor: `${recentLoc.postalCode ? 'Postal ' + recentLoc.postalCode : ''}${recentLoc.postalCode && recentLoc.streetName ? ', ' : ''}${recentLoc.streetName || ''}`
                }
            }
            return call
        }

        const processedModCalls = modCalls.map(attachLoc)
        const processedEmerCalls = emergencyCalls.map(attachLoc)

        return NextResponse.json({
            modCalls: processedModCalls,
            emergencyCalls: processedEmerCalls
        })
    } catch (error) {
        console.error("Calls fetch error:", error)
        return new NextResponse("Failed to fetch calls", { status: 500 })
    }
}
