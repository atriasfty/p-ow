import { getSession } from "@/lib/auth-clerk"
import { isServerMember } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { PrcClient } from "@/lib/prc"
import { checkSecurity } from "@/lib/security"
import { getServerConfig } from "@/lib/server-config"
import { NextResponse } from "next/server"

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
    const username = searchParams.get("username")
    const userId = searchParams.get("userId")

    if (!serverId) return new NextResponse("Missing serverId", { status: 400 })
    if (!username && !userId) return new NextResponse("Missing username or userId", { status: 400 })

    // Tenant isolation: only members of this server may probe its player list.
    if (!(await isServerMember(session.user as any, serverId))) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    // --- SECURITY CHECK ---
    const securityBlock = await checkSecurity(req)
    if (securityBlock) return securityBlock
    // ----------------------

    const server = await getServerConfig(serverId)
    if (!server) return new NextResponse("Server not found", { status: 404 })

    try {
        // Use existing PrcClient which has rate limiting built-in
        const client = new PrcClient(server.apiUrl)
        const rawPlayers = await client.getPlayers()

        // Find the target player (case-insensitive match)
        const searchUsername = username?.toLowerCase()
        const searchUserId = userId

        const foundPlayer = rawPlayers.find(p => {
            const player = parsePlayer(p.Player)
            if (searchUserId && player.id === searchUserId) return true
            if (searchUsername && player.name.toLowerCase() === searchUsername) return true
            return false
        })

        if (!foundPlayer) {
            // Player not online - check if they're a staff member
            const staffInfo = await getStaffInfo(serverId, username, userId)
            return NextResponse.json({
                online: false,
                staffInfo
            })
        }

        // Player is online - parse their data
        const playerData = parsePlayer(foundPlayer.Player)

        // Get staff info (role, duty status, discord username)
        const staffInfo = await getStaffInfo(serverId, playerData.name, playerData.id)

        console.log(`[PLAYER-STATUS] ${playerData.name}: Permission=${foundPlayer.Permission}, Team=${foundPlayer.Team}, Callsign=${foundPlayer.Callsign}`)

        return NextResponse.json({
            online: true,
            name: playerData.name,
            id: playerData.id,
            team: foundPlayer.Team || "Civilian",
            vehicle: foundPlayer.Vehicle || null,
            callsign: foundPlayer.Callsign || null,
            permission: foundPlayer.Permission ?? 0,
            staffInfo
        })
    } catch (error) {
        console.error("Player status fetch error:", error)
        return new NextResponse("Failed to fetch player status", { status: 500 })
    }
}

// Helper to get staff-related info from database
async function getStaffInfo(serverId: string, username?: string | null, robloxId?: string | null) {
    if (!username && !robloxId) return null

    // Try to find member by Roblox ID first, then by username patterns
    let member = null

    if (robloxId) {
        member = await prisma.member.findFirst({
            where: {
                serverId,
                userId: robloxId
            },
            include: { role: true }
        })
    }

    if (!member) return null

    // Check if on duty (has active shift)
    const activeShift = await prisma.shift.findFirst({
        where: {
            serverId,
            userId: member.userId,
            endTime: null
        }
    })

    // Get Discord username from Clerk if available
    // We stored discordId on the member record
    let discordUsername = null
    if (member.discordId) {
        // We can't easily get Discord username from just the ID without API call
        // But we can return the Discord ID for now
        discordUsername = member.discordId
    }

    return {
        isStaff: true,
        roleName: member.role?.name || null,
        isOnDuty: !!activeShift,
        shiftStart: activeShift?.startTime || null,
        discordId: member.discordId || null,
        isAdmin: member.isAdmin
    }
}
