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

        // ⚡ Bolt: Eliminate N+1 queries by fetching fallback locations in a single batched query
        const callsNeedingLocation = [...modCalls, ...emergencyCalls].filter(c => !c.positionDescriptor);
        const callerIds = Array.from(new Set(callsNeedingLocation.map(c => c.callerId)));

        let locationsByUser = new Map<string, any[]>();

        if (callerIds.length > 0) {
            // Find max/min timestamp to tightly bound the query and prevent fetching all history
            const maxTimestamp = Math.max(...callsNeedingLocation.map(c => c.timestamp || 0));
            const minTimestamp = Math.min(...callsNeedingLocation.map(c => c.timestamp || Number.MAX_SAFE_INTEGER));

            const lteDate = new Date(maxTimestamp * 1000 + 30000); // max + 30s
            // Assuming we only care about locations within 10 minutes prior to the earliest call
            const gteDate = new Date(minTimestamp * 1000 - (10 * 60 * 1000));

            const recentLocations = await prisma.playerLocation.findMany({
                where: {
                    serverId,
                    userId: { in: callerIds },
                    createdAt: {
                        lte: lteDate,
                        gte: gteDate
                    }
                },
                orderBy: { createdAt: "desc" }
            });

            for (const loc of recentLocations) {
                if (!locationsByUser.has(loc.userId)) locationsByUser.set(loc.userId, []);
                locationsByUser.get(loc.userId)!.push(loc);
            }
        }

        const attachLocation = (call: any) => {
            if (call.positionDescriptor) return call;
            const targetTime = (call.timestamp || 0) * 1000 + 30000;
            const userLocs = locationsByUser.get(call.callerId) || [];
            const recentLoc = userLocs.find(l => l.createdAt.getTime() <= targetTime);

            if (recentLoc && (recentLoc.postalCode || recentLoc.streetName)) {
                return {
                    ...call,
                    positionDescriptor: `${recentLoc.postalCode ? 'Postal ' + recentLoc.postalCode : ''}${recentLoc.postalCode && recentLoc.streetName ? ', ' : ''}${recentLoc.streetName || ''}`
                };
            }
            return call;
        };

        const processedModCalls = modCalls.map(attachLocation);
        const processedEmerCalls = emergencyCalls.map(attachLocation);

        return NextResponse.json({
            modCalls: processedModCalls,
            emergencyCalls: processedEmerCalls
        })
    } catch (error) {
        console.error("Calls fetch error:", error)
        return new NextResponse("Failed to fetch calls", { status: 500 })
    }
}
