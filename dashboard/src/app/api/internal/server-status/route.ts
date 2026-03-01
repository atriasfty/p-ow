import { prisma } from "@/lib/db"
import { PrcClient } from "@/lib/prc"
import { NextResponse } from "next/server"
import crypto from "crypto"

const INTERNAL_SECRET = process.env.INTERNAL_SYNC_SECRET!

export async function GET(req: Request) {
    const authHeader = req.headers.get("x-internal-secret")

    if (!authHeader || authHeader.length !== INTERNAL_SECRET.length || !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(INTERNAL_SECRET))) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")

    if (!serverId) {
        return NextResponse.json({ error: "Missing serverId" }, { status: 400 })
    }

    const server = await prisma.server.findUnique({ where: { id: serverId } })
    if (!server) {
        return NextResponse.json({ error: "Server not found" }, { status: 404 })
    }

    try {
        const client = new PrcClient(server.apiUrl)

        const [serverData, players] = await Promise.all([
            client.getServer().catch(() => null),
            client.getPlayers().catch(() => [])
        ])

        // Count staff in-game (players with permissions)
        const staffInGame = players.filter((p: any) => {
            const perm = p.Permission
            return perm === "Server Moderator" || perm === "Server Administrator" || (typeof perm === "number" && perm > 0)
        }).length

        return NextResponse.json({
            serverInfo: {
                online: !!serverData,
                players: serverData?.CurrentPlayers || 0,
                maxPlayers: serverData?.MaxPlayers || 0
            },
            staffInGame
        })

    } catch (e) {
        return NextResponse.json({
            serverInfo: { online: false, players: 0, maxPlayers: 0 },
            staffInGame: 0
        })
    }
}
