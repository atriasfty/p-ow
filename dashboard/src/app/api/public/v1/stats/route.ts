import { prisma } from "@/lib/db"
import { validatePublicApiKey, withRateLimit, resolveServer, logApiAccess } from "@/lib/public-auth"
import { fetchServerStats } from "@/lib/server-utils"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    // 1. Validate API Key
    const auth = await validatePublicApiKey()
    if (!auth.valid) return withRateLimit(NextResponse.json({ error: auth.error }, { status: auth.status || 401 }), auth)

    // 2. Get Server Name from Query
    const { searchParams } = new URL(req.url)

    // 3. Find Server
    const server = await resolveServer(auth.apiKey)
    if (!server) {
        return withRateLimit(NextResponse.json({ error: "Server not found" }, { status: 404 }), auth)
    }

    try {
        // 4. Fetch Stats
        const stats = await fetchServerStats(server.apiUrl)

        // 5. Log Access
        await logApiAccess(auth.apiKey, "PUBLIC_STATS_COLLECTED", `Server: ${server.name}`)

        return withRateLimit(NextResponse.json({
            id: server.id,
            name: server.customName || server.name,
            online: stats.online,
            players: stats.players,
            maxPlayers: stats.maxPlayers,
            timestamp: new Date().toISOString()
        }), auth)
    } catch (e) {
        console.error("Public API Error:", e)
        return withRateLimit(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }), auth)
    }
}
