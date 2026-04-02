import { NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { prisma } from "@/lib/db"
import { PrcClient } from "@/lib/prc"
import { verifyVisionSignature, getVisionCorsHeaders } from "@/lib/vision-auth"

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
        // Validate required environment variable
        if (!process.env.VISION_JWT_SECRET) {
            console.error("[Vision Users] VISION_JWT_SECRET is not set!")
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500, headers: getVisionCorsHeaders(req) }
            )
        }

        const VISION_SECRET = new TextEncoder().encode(process.env.VISION_JWT_SECRET)

        // Verify HMAC signature
        const signature = req.headers.get("X-Vision-Sig")
        if (!verifyVisionSignature(signature)) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 403, headers: getVisionCorsHeaders(req) }
            )
        }

        // Verify Vision token
        const authHeader = req.headers.get("Authorization")
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "No token provided" }, { status: 401, headers: getVisionCorsHeaders(req) })
        }

        const token = authHeader.substring(7)
        try {
            await jwtVerify(token, VISION_SECRET, {
                issuer: "pow-dashboard",
                audience: "pow-vision"
            })
        } catch {
            return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: getVisionCorsHeaders(req) })
        }

        // Fetch active servers
        const servers = await prisma.server.findMany({
            where: {
                apiUrl: { not: "" }, // Only servers with API URL
                suspendedRoleId: null // Skip suspended servers if applicable, or just check API
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
