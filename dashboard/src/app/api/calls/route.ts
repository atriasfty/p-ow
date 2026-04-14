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
        const processedModCalls = await Promise.all(modCalls.map(async (call) => {
            if (call.positionDescriptor) return call
            const recentLoc = await prisma.playerLocation.findFirst({
                where: {
                    serverId,
                    userId: call.callerId,
                    // Try to find a location within 1 minute of the call
                    createdAt: {
                        lte: new Date((call.timestamp || 0) * 1000 + 30000), // +30s
                    }
                },
                orderBy: { createdAt: "desc" }
            })
            if (recentLoc && (recentLoc.postalCode || recentLoc.streetName)) {
                return {
                    ...call,
                    positionDescriptor: `${recentLoc.postalCode ? 'Postal ' + recentLoc.postalCode : ''}${recentLoc.postalCode && recentLoc.streetName ? ', ' : ''}${recentLoc.streetName || ''}`
                }
            }
            return call
        }))

        const processedEmerCalls = await Promise.all(emergencyCalls.map(async (call) => {
            if (call.positionDescriptor) return call
            const recentLoc = await prisma.playerLocation.findFirst({
                where: {
                    serverId,
                    userId: call.callerId,
                    createdAt: {
                        lte: new Date((call.timestamp || 0) * 1000 + 30000),
                    }
                },
                orderBy: { createdAt: "desc" }
            })
            if (recentLoc && (recentLoc.postalCode || recentLoc.streetName)) {
                return {
                    ...call,
                    positionDescriptor: `${recentLoc.postalCode ? 'Postal ' + recentLoc.postalCode : ''}${recentLoc.postalCode && recentLoc.streetName ? ', ' : ''}${recentLoc.streetName || ''}`
                }
            }
            return call
        }))

        return NextResponse.json({
            modCalls: processedModCalls,
            emergencyCalls: processedEmerCalls
        })
    } catch (error) {
        console.error("Calls fetch error:", error)
        return new NextResponse("Failed to fetch calls", { status: 500 })
    }
}
