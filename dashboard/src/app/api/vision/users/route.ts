import { NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { prisma } from "@/lib/db"
import { PrcClient } from "@/lib/prc"
import { verifyVisionDevice, getVisionCorsHeaders } from "@/lib/vision-auth"
import { checkSecurity } from "@/lib/security"

// Handle preflight requests
export async function OPTIONS(req: Request) {
    return NextResponse.json({}, { headers: getVisionCorsHeaders(req) })
}

// Parse "username:userId" format
function parsePlayer(str: string | undefined): { name: string, id: string } {
    if (!str) return { name: "Unknown", id: "" }
    const parts = str.split(":")
    if (parts.length >= 2) {
        return { name: parts[0], id: parts[parts.length - 1] }
    }
    return { name: str, id: "" }
}

// Get all players from all servers
export async function GET(req: Request) {
    try {
        // Rate-limit / IP-ban check — this route fans out live PRC API calls to
        // every server the caller belongs to, so throttle to bound API budget use.
        const secBlock = await checkSecurity(req)
        if (secBlock) return secBlock

        // Validate required environment variable
        if (!process.env.VISION_JWT_SECRET) {
            console.error("[Vision Users] VISION_JWT_SECRET is not set!")
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500, headers: getVisionCorsHeaders(req) }
            )
        }

        const VISION_SECRET = new TextEncoder().encode(process.env.VISION_JWT_SECRET)

        // Verify Vision token
        const authHeader = req.headers.get("Authorization")
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "No token provided" }, { status: 401, headers: getVisionCorsHeaders(req) })
        }

        const token = authHeader.substring(7)
        let visionPayload: any
        try {
            const result = await jwtVerify(token, VISION_SECRET, {
                issuer: "pow-dashboard",
                audience: "pow-vision"
            })
            visionPayload = result.payload
        } catch {
            return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: getVisionCorsHeaders(req) })
        }

        // Verify the request came from a registered Vision device (GET, empty body)
        const validDevice = await verifyVisionDevice(
            req.headers.get("X-Vision-Sig"),
            visionPayload.userId as string,
            req,
            ""
        )
        if (!validDevice) {
            return NextResponse.json(
                { error: "Unauthorized: invalid or unregistered device" },
                { status: 403, headers: getVisionCorsHeaders(req) }
            )
        }

        // Scope to only the servers where the requesting user is a member
        const memberServers = await prisma.member.findMany({
            where: { userId: visionPayload.userId as string },
            select: { serverId: true }
        })
        let serverIds = memberServers.map((m: { serverId: string }) => m.serverId)

        // Optional single-server scope (Vision app's server picker). Only
        // ever narrows the already-verified membership list — a
        // requested serverId the caller isn't a member of is ignored
        // rather than trusted, so this can't be used to read another
        // server's roster.
        const requestedServerId = new URL(req.url).searchParams.get("serverId")
        if (requestedServerId) {
            serverIds = serverIds.filter(id => id === requestedServerId)
        }

        const servers = await prisma.server.findMany({
            where: {
                id: { in: serverIds },
                apiUrl: { not: "" }
            }
        })

        const allUsernames = new Set<string>()

        // Fetch players from all servers in parallel
        await Promise.all(servers.map(async (server: any) => {
            try {
                const client = new PrcClient(server.apiUrl)
                // Set a short timeout for PRC calls so one slow server doesn't block everything
                const players = await Promise.race([
                    client.getPlayers(),
                    new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
                ])

                if (Array.isArray(players)) {
                    players.forEach(p => {
                        const { name } = parsePlayer(p.Player)
                        if (name && name !== "Unknown") {
                            allUsernames.add(name)
                        }
                    })
                }
            } catch (e) {
                // Ignore errors/timeouts from individual servers
            }
        }))

        return NextResponse.json(Array.from(allUsernames), { headers: getVisionCorsHeaders(req) })
    } catch (error) {
        console.error("[Vision Users] Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: getVisionCorsHeaders(req) })
    }
}
