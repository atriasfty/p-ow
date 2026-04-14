
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { PrcClient } from "@/lib/prc"
import { checkSecurity } from "@/lib/security"
import { getServerConfig } from "@/lib/server-config"
import { NextResponse } from "next/server"
import { isServerMember } from "@/lib/admin"

// Cache for player lists (30 second TTL)
interface CacheEntry {
    data: any[]
    timestamp: number
}
const playersCache = new Map<string, CacheEntry>()
const CACHE_TTL = 30 * 1000 // 30 seconds

// Parse "username:userId" format
function parsePlayer(str: string | undefined): { name: string, id: string } {
    if (!str) return { name: "Unknown", id: "" }
    const parts = str.split(":")
    if (parts.length >= 2) {
        return { name: parts[0], id: parts[parts.length - 1] }
    }
    return { name: str, id: "" }
}

export async function GET(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")

    if (!serverId) return new NextResponse("Missing serverId", { status: 400 })

    if (!(await isServerMember(session.user as any, serverId))) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    // --- SECURITY CHECK ---
    const securityBlock = await checkSecurity(req)
    if (securityBlock) return securityBlock
    // ----------------------

    const server = await getServerConfig(serverId)

    if (!server) return new NextResponse("Server not found", { status: 404 })

    const cacheKey = `players:${serverId}`
    const now = Date.now()
    const cached = playersCache.get(cacheKey)

    // Return cached data if fresh
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        return NextResponse.json(cached.data)
    }

    try {
        const client = new PrcClient(server.apiUrl)
        const rawPlayers = await client.getPlayers()

        // Parse players and extract user IDs
        const parsedPlayers = rawPlayers.map(p => {
            const player = parsePlayer(p.Player)
            return {
                name: player.name,
                id: player.id,
                team: p.Team,
                permission: p.Permission,
                vehicle: p.Vehicle,
                callsign: p.Callsign,
                location: p.Location ? {
                    x: p.Location.LocationX,
                    z: p.Location.LocationZ,
                    postal: p.Location.PostalCode,
                    street: p.Location.StreetName,
                    building: p.Location.BuildingNumber
                } : null,
                avatar: null as string | null
            }
        })

        // Fetch avatars for all players (batch request)
        const userIds = parsedPlayers.map(p => p.id).filter(id => id)
        if (userIds.length > 0) {
            try {
                const avatarRes = await fetch(
                    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userIds.join(",")}&size=48x48&format=Png&isCircular=true`,
                    { next: { revalidate: 300 } } // Cache for 5 minutes
                )
                if (avatarRes.ok) {
                    const avatarData = await avatarRes.json()
                    const avatarMap = new Map<string, string>()
                    for (const item of avatarData.data || []) {
                        if (item.imageUrl) {
                            avatarMap.set(String(item.targetId), item.imageUrl)
                        }
                    }
                    // Assign avatars to players
                    for (const player of parsedPlayers) {
                        player.avatar = avatarMap.get(player.id) || null
                    }
                }
            } catch (e) {
                console.warn("Avatar fetch failed:", e)
            }
        }

        // Cache the result
        playersCache.set(cacheKey, { data: parsedPlayers, timestamp: now })

        return NextResponse.json(parsedPlayers)
    } catch (error) {
        console.error("Player fetch error:", error)
        // Return cached data if available, even if stale
        if (cached) {
            return NextResponse.json(cached.data)
        }
        return new NextResponse("Failed to fetch players", { status: 500 })
    }
}
