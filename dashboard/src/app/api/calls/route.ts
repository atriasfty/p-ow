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
        let processedModCalls: any[] = modCalls
        let processedEmerCalls: any[] = emergencyCalls

        const callsNeedingLocation = [...modCalls, ...emergencyCalls].filter(c => !c.positionDescriptor)
        if (callsNeedingLocation.length > 0) {
            // ⚡ Bolt: Batching location queries to avoid N+1 query bottleneck and applying tight date bounds
            const callerIds = Array.from(new Set(callsNeedingLocation.map(c => c.callerId)))
            const minTimestamp = Math.min(...callsNeedingLocation.map(c => c.timestamp || 0))
            const maxTimestamp = Math.max(...callsNeedingLocation.map(c => c.timestamp || 0))

            const minDate = new Date(minTimestamp * 1000 - 5 * 60000) // 5 mins before earliest call
            const maxDate = new Date(maxTimestamp * 1000 + 30000) // 30s after latest call

            const locations = await prisma.playerLocation.findMany({
                where: {
                    serverId,
                    userId: { in: callerIds },
                    createdAt: {
                        gte: minDate,
                        lte: maxDate
                    }
                },
                orderBy: { createdAt: "desc" }
            })

            const locationsByUser = new Map<string, typeof locations>()
            for (const loc of locations) {
                if (!locationsByUser.has(loc.userId)) {
                    locationsByUser.set(loc.userId, [])
                }
                locationsByUser.get(loc.userId)!.push(loc)
            }

            const attachLocation = (call: any) => {
                if (call.positionDescriptor) return call

                const userLocs = locationsByUser.get(call.callerId) || []
                const callTargetTime = (call.timestamp || 0) * 1000 + 30000

                const recentLoc = userLocs.find((loc: any) => loc.createdAt.getTime() <= callTargetTime)

                if (recentLoc && (recentLoc.postalCode || recentLoc.streetName)) {
                    return {
                        ...call,
                        positionDescriptor: `${recentLoc.postalCode ? 'Postal ' + recentLoc.postalCode : ''}${recentLoc.postalCode && recentLoc.streetName ? ', ' : ''}${recentLoc.streetName || ''}`
                    }
                }
                return call
            }

            processedModCalls = modCalls.map(attachLocation)
            processedEmerCalls = emergencyCalls.map(attachLocation)
        }

        return NextResponse.json({
            modCalls: processedModCalls,
            emergencyCalls: processedEmerCalls
        })
    } catch (error) {
        console.error("Calls fetch error:", error)
        return new NextResponse("Failed to fetch calls", { status: 500 })
    }
}
