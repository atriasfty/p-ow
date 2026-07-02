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

    // Try to find a location within ~1 minute of the call. Anchor on call.timestamp
    // (PRC-sourced, may be null) falling back to call.createdAt (DB insert time,
    // always present) — and bound the lookback with a `gte` floor so a player's
    // location from hours/days earlier can't be mistaken for their position at
    // call time just because it's the most recent row before the cutoff.
    const resolvePositionDescriptor = async (call: { callerId: string; timestamp: number | null; createdAt: Date; positionDescriptor: string | null }) => {
        if (call.positionDescriptor) return call.positionDescriptor
        const anchorMs = call.timestamp ? call.timestamp * 1000 : call.createdAt.getTime()
        const recentLoc = await prisma.playerLocation.findFirst({
            where: {
                serverId,
                userId: call.callerId,
                createdAt: {
                    gte: new Date(anchorMs - 60_000), // -1m
                    lte: new Date(anchorMs + 30_000), // +30s
                }
            },
            orderBy: { createdAt: "desc" }
        })
        if (recentLoc && (recentLoc.postalCode || recentLoc.streetName)) {
            return `${recentLoc.postalCode ? 'Postal ' + recentLoc.postalCode : ''}${recentLoc.postalCode && recentLoc.streetName ? ', ' : ''}${recentLoc.streetName || ''}`
        }
        return call.positionDescriptor
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
        const processedModCalls = await Promise.all(modCalls.map(async (call) => ({
            ...call,
            positionDescriptor: await resolvePositionDescriptor(call)
        })))

        const processedEmerCalls = await Promise.all(emergencyCalls.map(async (call) => ({
            ...call,
            positionDescriptor: await resolvePositionDescriptor(call)
        })))

        return NextResponse.json({
            modCalls: processedModCalls,
            emergencyCalls: processedEmerCalls
        })
    } catch (error) {
        console.error("Calls fetch error:", error)
        return new NextResponse("Failed to fetch calls", { status: 500 })
    }
}
