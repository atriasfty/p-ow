import { prisma } from "@/lib/db"
import { validatePublicApiKey, withRateLimit, resolveServer, logApiAccess } from "@/lib/public-auth"
import { NextResponse } from "next/server"
import { withHttpMetrics } from "@/lib/http-metrics"

export const GET = withHttpMetrics("public/v1/members", async (req: Request) => {
    const auth = await validatePublicApiKey()
    if (!auth.valid) return withRateLimit(NextResponse.json({ error: auth.error }, { status: auth.status || 401 }), auth)

    const { searchParams } = new URL(req.url)

    // Pagination — bound the response so a large roster can't return an unbounded payload.
    const take = Math.min(Math.max(parseInt(searchParams.get("limit") || "100") || 100, 1), 200)
    const skip = Math.max(parseInt(searchParams.get("offset") || "0") || 0, 0)

    const server = await resolveServer(auth.apiKey)
    if (!server) return withRateLimit(NextResponse.json({ error: "Server not found" }, { status: 404 }), auth)

    try {
        const members = await prisma.member.findMany({
            where: { serverId: server.id },
            take,
            skip,
            orderBy: { createdAt: "asc" },
            include: {
                role: {
                    select: {
                        name: true,
                        color: true,
                        isDefault: true
                    }
                }
            }
        })

        await logApiAccess(auth.apiKey, "PUBLIC_MEMBER_LIST_FETCHED", `Server: ${server.name}`)
        return withRateLimit(NextResponse.json(members), auth)
    } catch (e) {
        console.error("Public Member List API Error:", e)
        return withRateLimit(NextResponse.json({ error: "Internal Error" }, { status: 500 }), auth)
    }
})
