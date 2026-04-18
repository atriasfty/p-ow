import { getSession } from "@/lib/auth-clerk"
import { verifyPermissionOrError } from "@/lib/auth-permissions"
import { prisma } from "@/lib/db"
import { fetchAndSaveLogs } from "@/lib/log-syncer"
import { checkSecurity } from "@/lib/security"
import { getServerOverride } from "@/lib/config"
import { NextResponse } from "next/server"

import { getServerConfig } from "@/lib/server-config"

// In-memory cache for logs
interface CacheEntry {
    data: any[]
    timestamp: number
}
const logsCache = new Map<string, CacheEntry>()
const MAX_CACHE_SIZE = 500 // Prevent memory leaks

export async function GET(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")
    const type = searchParams.get("type") // join, kill, command
    const userId = searchParams.get("userId") // Optional: filter by user
    const query = searchParams.get("query")?.trim() || "" // Search query
    const fetchType = type || "all"
    const offset = parseInt(searchParams.get("offset") || "0")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100) // Cap at 100

    if (!serverId) return new NextResponse("Missing params", { status: 400 })

    // Dynamic TTL from server config
    const cacheTtl = await getServerOverride(serverId, "logCacheTtl")

    // Check cache first (include query in cache key)
    const cacheKey = `${serverId}:${fetchType}:${userId || ""}:${query}:${offset}:${limit}`
    const cached = logsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < cacheTtl) {
        return NextResponse.json(cached.data)
    }

    // Optimization 4: Size-limited cache management
    if (logsCache.size > MAX_CACHE_SIZE) {
        logsCache.clear()
    }

    const server = await getServerConfig(serverId)
    if (!server) return new NextResponse("Server not found", { status: 404 })

    // Verify permission - require canViewLogs
    const error = await verifyPermissionOrError(session.user, serverId, "canViewLogs")
    if (error) return error

    // --- SECURITY CHECK ---
    const securityBlock = await checkSecurity(req)
    if (securityBlock) return securityBlock

    // Build query for historical logs from database
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    const whereClause: any = {
        serverId,
        createdAt: { gte: oneMonthAgo }
    }

    if (fetchType !== "all") {
        whereClause.type = fetchType
    }

    // Build search conditions
    const searchConditions: any[] = []

    // User ID filter
    if (userId) {
        // Also get username query param for fallback search
        const username = searchParams.get("username")

        searchConditions.push({
            OR: [
                { playerId: userId },
                { killerId: userId },
                { victimId: userId },
                // Also search by username in case IDs don't match
                ...(username ? [
                    { playerName: { contains: username } },
                    { killerName: { contains: username } },
                    { victimName: { contains: username } }
                ] : [])
            ]
        })
    }

    // Search query filter (searches player names, killer/victim names, and commands)
    if (query) {
        searchConditions.push({
            OR: [
                { playerName: { contains: query } },
                { killerName: { contains: query } },
                { victimName: { contains: query } },
                { command: { contains: query } }
            ]
        })
    }

    // Combine conditions with AND if any exist
    if (searchConditions.length > 0) {
        whereClause.AND = searchConditions
    }

    // Get logs from database - only select needed fields
    const dbLogs = await prisma.log.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        select: {
            id: true,
            type: true,
            playerName: true,
            playerId: true,
            killerName: true,
            killerId: true,
            victimName: true,
            victimId: true,
            command: true,
            arguments: true,
            isJoin: true,
            prcTimestamp: true,
            createdAt: true
        }
    })

    // Convert to API format
    const logs = dbLogs.map((log: any) => {
        const base = {
            id: log.id,
            _type: log.type,
            timestamp: log.prcTimestamp || Math.floor(log.createdAt.getTime() / 1000)
        }

        if (log.type === "join") {
            return { ...base, PlayerName: log.playerName, PlayerId: log.playerId, Join: log.isJoin }
        } else if (log.type === "kill") {
            return { ...base, KillerName: log.killerName, KillerId: log.killerId, VictimName: log.victimName, VictimId: log.victimId }
        } else if (log.type === "command") {
            return { ...base, PlayerName: log.playerName, PlayerId: log.playerId, Command: log.command, Arguments: log.arguments }
        }
        return base
    })

    // Cache the result
    logsCache.set(cacheKey, { data: logs, timestamp: Date.now() })

    return NextResponse.json(logs)
}

