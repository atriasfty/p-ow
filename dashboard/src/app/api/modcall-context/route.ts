import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerMember } from "@/lib/admin"
import { NextResponse } from "next/server"

const NEARBY_RADIUS = 200 // game-units
const TIME_WINDOW_MS = 2 * 60 * 1000 // ±2 minutes for nearby player lookup
const LOG_WINDOW_MS = 5 * 60 * 1000 // ±5 minutes for log lookup

export async function GET(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")
    const callId = searchParams.get("callId")

    if (!serverId || !callId) {
        return NextResponse.json({ error: "Missing serverId or callId" }, { status: 400 })
    }

    if (!(await isServerMember(session.user as any, serverId))) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    // 1. Get the mod call
    const modCall = await prisma.modCall.findUnique({ where: { id: callId } })
    if (!modCall || modCall.serverId !== serverId) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 })
    }

    // 2. Find nearby players at the time of the call
    const callTime = modCall.createdAt
    const timeStart = new Date(callTime.getTime() - TIME_WINDOW_MS)
    const timeEnd = new Date(callTime.getTime() + TIME_WINDOW_MS)

    let nearbyPlayers: any[] = []
    if (modCall.positionX != null && modCall.positionZ != null) {
        // Get all player locations in the time window
        const locations = await prisma.playerLocation.findMany({
            where: {
                serverId,
                createdAt: { gte: timeStart, lte: timeEnd }
            },
            orderBy: { createdAt: "desc" },
            distinct: ["userId"]
        })

        // Filter to those within the radius
        nearbyPlayers = locations.filter(loc => {
            const dx = loc.locationX - modCall.positionX!
            const dz = loc.locationZ - modCall.positionZ!
            return Math.sqrt(dx * dx + dz * dz) <= NEARBY_RADIUS
        }).map(loc => ({
            userId: loc.userId,
            playerName: loc.playerName,
            locationX: loc.locationX,
            locationZ: loc.locationZ,
            postalCode: loc.postalCode,
            streetName: loc.streetName
        }))
    }

    // 3. Collect all involved player IDs (caller + nearby + responding mods)
    const involvedIds = new Set<string>()
    involvedIds.add(modCall.callerId)
    nearbyPlayers.forEach(p => involvedIds.add(p.userId))

    let respondingMods: string[] = []
    if (modCall.respondingPlayers) {
        try {
            respondingMods = JSON.parse(modCall.respondingPlayers)
            respondingMods.forEach(id => involvedIds.add(id))
        } catch { /* ignore bad JSON */ }
    }

    // 4. Get filtered logs for all involved players (within ±5 min of call)
    const logStart = new Date(callTime.getTime() - LOG_WINDOW_MS)
    const logEnd = new Date(callTime.getTime() + LOG_WINDOW_MS)
    const involvedArray = Array.from(involvedIds)

    const logs = await prisma.log.findMany({
        where: {
            serverId,
            createdAt: { gte: logStart, lte: logEnd },
            OR: [
                { playerId: { in: involvedArray } },
                { killerId: { in: involvedArray } },
                { victimId: { in: involvedArray } }
            ]
        },
        orderBy: { createdAt: "desc" },
        take: 200
    })

    // 5. Get current live positions of all involved players (most recent)
    const currentPositions = await prisma.playerLocation.findMany({
        where: {
            serverId,
            userId: { in: involvedArray },
            createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) }
        },
        orderBy: { createdAt: "desc" },
        distinct: ["userId"]
    })

    return NextResponse.json({
        call: {
            id: modCall.id,
            callerId: modCall.callerId,
            callerName: modCall.callerName,
            description: modCall.description,
            callNumber: modCall.callNumber,
            positionX: modCall.positionX,
            positionZ: modCall.positionZ,
            positionDescriptor: modCall.positionDescriptor,
            respondingPlayers: respondingMods,
            timestamp: modCall.timestamp,
            createdAt: modCall.createdAt
        },
        nearbyPlayers,
        currentPositions: currentPositions.map(p => ({
            userId: p.userId,
            playerName: p.playerName,
            locationX: p.locationX,
            locationZ: p.locationZ,
            postalCode: p.postalCode,
            streetName: p.streetName
        })),
        logs: logs.map(l => ({
            id: l.id,
            _type: l.type,
            PlayerName: l.playerName,
            PlayerId: l.playerId,
            KillerName: l.killerName,
            KillerId: l.killerId,
            VictimName: l.victimName,
            VictimId: l.victimId,
            Command: l.command,
            Arguments: l.arguments,
            Join: l.type === "join" ? l.isJoin : undefined,
            timestamp: l.prcTimestamp,
            createdAt: l.createdAt
        })),
        involvedPlayerIds: involvedArray
    })
}
