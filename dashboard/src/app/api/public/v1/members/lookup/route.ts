import { prisma } from "@/lib/db"
import { validatePublicApiKey, withRateLimit, resolveServer, logApiAccess } from "@/lib/public-auth"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const auth = await validatePublicApiKey()
    if (!auth.valid) return withRateLimit(NextResponse.json({ error: auth.error }, { status: auth.status || 401 }), auth)

    const { searchParams } = new URL(req.url)
    const robloxId = searchParams.get("robloxId")

    if (!robloxId) {
        return withRateLimit(NextResponse.json({ error: "Missing 'robloxId' query parameter" }, { status: 400 }), auth)
    }

    const server = await resolveServer(auth.apiKey)
    if (!server) return withRateLimit(NextResponse.json({ error: "Server not found" }, { status: 404 }), auth)

    try {
        const member = await prisma.member.findFirst({
            where: {
                serverId: server.id,
                robloxId: robloxId
            },
            select: {
                userId: true,
                robloxId: true,
                robloxUsername: true,
                discordId: true,
                isAdmin: true,
                role: {
                    select: {
                        name: true,
                        color: true
                    }
                }
            }
        })

        if (!member) {
            return withRateLimit(NextResponse.json({ error: "No staff member found with that Roblox ID in this server" }, { status: 404 }), auth)
        }

        await logApiAccess(auth.apiKey, "PUBLIC_MEMBER_LOOKUP", `RobloxID: ${robloxId}, ClerkID: ${member.userId}, Server: ${server.name}`)

        return withRateLimit(NextResponse.json({
            clerkUserId: member.userId,
            robloxId: member.robloxId,
            robloxUsername: member.robloxUsername,
            discordId: member.discordId,
            isAdmin: member.isAdmin,
            role: member.role
        }), auth)
    } catch (e) {
        console.error("Public Member Lookup API Error:", e)
        return withRateLimit(NextResponse.json({ error: "Internal Error" }, { status: 500 }), auth)
    }
}
