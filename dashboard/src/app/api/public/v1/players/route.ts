import { prisma } from "@/lib/db"
import { validatePublicApiKey, withRateLimit, resolveServer, logApiAccess } from "@/lib/public-auth"
import { PrcClient } from "@/lib/prc"
import { parsePrcPlayer } from "@/lib/prc-types"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    // 1. Validate API Key
    const auth = await validatePublicApiKey()
    if (!auth.valid) {
        return withRateLimit(NextResponse.json({ error: auth.error }, { status: auth.status || 401 }), auth)
    }

    // 2. Get Server Name from Query
    const { searchParams } = new URL(req.url)

    // 3. Find Server
    const server = await resolveServer(auth.apiKey)
    if (!server) {
        return withRateLimit(NextResponse.json({ error: "Server not found" }, { status: 404 }), auth)
    }

    try {
        // 4. Fetch Players from PRC
        const client = new PrcClient(server.apiUrl)
        const rawPlayers = await client.getPlayers()

        const players = rawPlayers.map(p => {
            const details = parsePrcPlayer(p.Player)
            return {
                name: details.name,
                id: details.id,
                team: p.Team,
                permission: p.Permission,
                vehicle: p.Vehicle,
                callsign: p.Callsign
            }
        })

        // 5. Log Access
        await logApiAccess(auth.apiKey, "PUBLIC_PLAYERS_COLLECTED", `Server: ${server.name}`)

        return withRateLimit(NextResponse.json({
            serverId: server.id,
            serverName: server.customName || server.name,
            playerCount: players.length,
            players,
            timestamp: new Date().toISOString()
        }), auth)
    } catch (e) {
        console.error("Public API Error:", e)
        return withRateLimit(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }), auth)
    }
}
