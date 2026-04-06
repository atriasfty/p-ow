import { prisma } from "@/lib/db"
import { validatePublicApiKey, withRateLimit, resolveServer, logApiAccess } from "@/lib/public-auth"
import { PrcClient } from "@/lib/prc"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    const auth = await validatePublicApiKey()
    if (!auth.valid) return withRateLimit(NextResponse.json({ error: auth.error }, { status: auth.status || 401 }), auth)

    const { searchParams } = new URL(req.url)
    const body = await req.json().catch(() => ({}))

    // Check searchParams first, then body
const { reason, requester } = body

    const server = await resolveServer(auth.apiKey)
    if (!server) return withRateLimit(NextResponse.json({ error: "Server not found" }, { status: 404 }), auth)

    try {
        const requesterName = requester || auth.apiKey.name || "API Integration"
        const client = new PrcClient(server.apiUrl)

        // ⚡ Bolt: Wrap external PRC calls in a timeout to prevent hanging if the game server is offline
        const [rawPlayers, serverData] = await Promise.race([
            Promise.all([
                client.getPlayers().catch(() => []),
                client.getServer().catch(() => null)
            ]),
            new Promise<[any[], any]>((_, reject) =>
                setTimeout(() => reject(new Error("Timeout")), 2500)
            )
        ]).catch(() => [[], null])

        const staffPlayers = rawPlayers.filter(p => {
            const perm = p.Permission as any
            return perm === "Server Moderator" || perm === "Server Administrator" || (typeof perm === "number" && perm > 0)
        })

        const staffOnDutyCount = await prisma.shift.count({
            where: { serverId: server.id, endTime: null }
        })

        if (staffPlayers.length > 0) {
            const staffNames = staffPlayers.map(p => p.Player.split(":")[0]).join(",")
            await client.executeCommand(`:pm ${staffNames} Staff request from ${requesterName}. Check dashboard for details!`).catch(() => { })
        }

        if (server.staffRequestChannelId) {
            const mentionRole = server.staffRoleId ? `<@&${server.staffRoleId}>` : ""
            await prisma.botQueue.create({
                data: {
                    serverId: server.id,
                    type: "MESSAGE",
                    targetId: server.staffRequestChannelId,
                    content: JSON.stringify({
                        content: mentionRole,
                        embeds: [{
                            title: "🚨 API Staff Request",
                            description: `**${requesterName}** has requested staff assistance!`,
                            fields: [
                                { name: "Reason", value: reason || "No reason provided", inline: false },
                                { name: "Server Status", value: `👥 **Players:** ${serverData?.CurrentPlayers || 0}/${serverData?.MaxPlayers || 0}\n🕒 **Staff On Duty:** ${staffOnDutyCount}`, inline: false }
                            ],
                            color: 0xFFA500,
                            timestamp: new Date().toISOString()
                        }]
                    }),
                    status: "PENDING"
                }
            })
        }

        await logApiAccess(auth.apiKey, "PUBLIC_STAFF_REQUEST", `Server: ${server.name}, Reason: ${reason}`)
        return withRateLimit(NextResponse.json({ success: true, staffNotified: staffPlayers.length }), auth)

    } catch (error: any) {
        console.error("Public Staff Request Error:", error)
        return withRateLimit(NextResponse.json({ error: "Internal Error" }, { status: 500 }), auth)
    }
}
