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

        // ⚡ Bolt: Pre-fetch fallback locations using tight date bounds to eliminate N+1 DB calls
        const allCalls = [...modCalls, ...emergencyCalls].filter(c => !c.positionDescriptor)
        let preFetchedLocations: any[] = []

        if (allCalls.length > 0) {
            // Find min/max timestamps across all missing-location calls to bound the query
            const timestamps = allCalls.map(c => c.timestamp || 0)
            const minTimestampMs = Math.min(...timestamps) * 1000
            const maxTimestampMs = Math.max(...timestamps) * 1000

            // Query relevant recent locations within a 2-minute window (1m before min, 30s after max)
            preFetchedLocations = await prisma.playerLocation.findMany({
                where: {
                    serverId,
                    userId: { in: Array.from(new Set(allCalls.map(c => c.callerId))) },
                    createdAt: {
                        gte: new Date(minTimestampMs - 60000),
                        lte: new Date(maxTimestampMs + 30000),
                    }
                },
                orderBy: { createdAt: "desc" }
            })
        }

        const resolveLocation = (call: any) => {
            if (call.positionDescriptor) return call

            const targetTimeMs = (call.timestamp || 0) * 1000
            // Find the most recent location before or up to 30s after the call
            const recentLoc = preFetchedLocations.find(loc =>
                loc.userId === call.callerId &&
                loc.createdAt.getTime() <= targetTimeMs + 30000
            )

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
