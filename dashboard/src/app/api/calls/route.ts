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
        // ⚡ Bolt: Eliminate N+1 queries by pre-fetching all relevant locations in a single bounded query
        const allCalls = [...modCalls, ...emergencyCalls];
        const callsNeedingLocation = allCalls.filter((c) => !c.positionDescriptor);

        let recentLocationsMap = new Map<string, any>();

        if (callsNeedingLocation.length > 0) {
            // Find tight bounds for the time window to avoid fetching the entire history
            const minTimestamp = Math.min(...callsNeedingLocation.map(c => c.timestamp || 0));
            const maxTimestamp = Math.max(...callsNeedingLocation.map(c => c.timestamp || 0));

            // Allow locations up to 1 minute before or 30s after the call
            const fromDate = new Date(minTimestamp * 1000 - 60000);
            const toDate = new Date(maxTimestamp * 1000 + 30000);

            const uniqueCallerIds = [...new Set(callsNeedingLocation.map((c) => c.callerId))];

            const recentLocations = await prisma.playerLocation.findMany({
                where: {
                    serverId,
                    userId: { in: uniqueCallerIds },
                    createdAt: {
                        gte: fromDate,
                        lte: toDate
                    }
                },
                orderBy: { createdAt: "desc" }
            });

            // Group locations by user
            const locationsByUser = new Map<string, any[]>();
            for (const loc of recentLocations) {
                if (!locationsByUser.has(loc.userId)) {
                    locationsByUser.set(loc.userId, []);
                }
                locationsByUser.get(loc.userId)!.push(loc);
            }

            recentLocationsMap = locationsByUser;
        }

        const attachLocation = (call: any) => {
            if (call.positionDescriptor) return call;

            const userLocs = recentLocationsMap.get(call.callerId) || [];
            // Find the most recent location before or up to 30s after the call
            const callTime = new Date((call.timestamp || 0) * 1000 + 30000);

            // userLocs are already sorted descending by createdAt from the findMany query
            const recentLoc = userLocs.find((loc: any) => loc.createdAt <= callTime);

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
