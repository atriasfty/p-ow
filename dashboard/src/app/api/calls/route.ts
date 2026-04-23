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

        // Gather all caller IDs that need location lookup
        const callsNeedingLocation = [...modCalls, ...emergencyCalls].filter(c => !c.positionDescriptor)
        const callerIds = [...new Set(callsNeedingLocation.map(c => c.callerId))]

        // Find min and max target times among calls that need locations to bound our query safely
        let maxTargetTime = 0
        let minCallTime = Date.now()
        callsNeedingLocation.forEach(c => {
            const t = (c.timestamp || 0) * 1000 + 30000 // target time (+30s)
            const cTime = (c.timestamp || 0) * 1000 // actual call time
            if (t > maxTargetTime) maxTargetTime = t
            if (cTime < minCallTime) minCallTime = cTime
        })

        let locationMap = new Map<string, any[]>()

        if (callerIds.length > 0) {
            // The original logic finds the first location before the target time.
            // To fetch this batched without fetching unbound history or using raw sql window functions,
            // we will bound the query from 5 minutes before the earliest call in the batch, up to the max target time.
            // 5 minutes is a reasonable bounding window to find a "recent" location in a live session.
            const minTimeBoundary = new Date(minCallTime - 5 * 60 * 1000)

            // Fetch relevant recent locations for these users in a single batched query
            const recentLocs = await prisma.playerLocation.findMany({
                where: {
                    serverId,
                    userId: { in: callerIds },
                    createdAt: {
                        lte: new Date(maxTargetTime),
                        gte: minTimeBoundary
                    }
                },
                orderBy: { createdAt: "desc" }
            })

            // Group locations by user ID for O(1) lookup
            recentLocs.forEach(loc => {
                if (!locationMap.has(loc.userId)) {
                    locationMap.set(loc.userId, [])
                }
                locationMap.get(loc.userId)!.push(loc)
            })
        }

        // Helper to resolve location from map
        const resolveLocation = (call: any) => {
            if (call.positionDescriptor) return call

            const userLocs = locationMap.get(call.callerId) || []
            const targetTime = (call.timestamp || 0) * 1000 + 30000

            // userLocs is sorted by createdAt "desc" from the db query
            // Find the first location that is less than or equal to our target time
            const recentLoc = userLocs.find(l => l.createdAt.getTime() <= targetTime)

            if (recentLoc && (recentLoc.postalCode || recentLoc.streetName)) {
                return {
                    ...call,
                    positionDescriptor: `${recentLoc.postalCode ? 'Postal ' + recentLoc.postalCode : ''}${recentLoc.postalCode && recentLoc.streetName ? ', ' : ''}${recentLoc.streetName || ''}`
                }
            }
            return call
        }

        const processedModCalls = modCalls.map(resolveLocation)
        const processedEmerCalls = emergencyCalls.map(resolveLocation)

        return NextResponse.json({
            modCalls: processedModCalls,
            emergencyCalls: processedEmerCalls
        })
    } catch (error) {
        console.error("Calls fetch error:", error)
        return new NextResponse("Failed to fetch calls", { status: 500 })
    }
}
