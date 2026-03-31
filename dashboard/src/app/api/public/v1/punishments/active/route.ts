import { prisma } from "@/lib/db"
import { validatePublicApiKey, withRateLimit, resolveServer, logApiAccess } from "@/lib/public-auth"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const auth = await validatePublicApiKey()
    if (!auth.valid) return withRateLimit(NextResponse.json({ error: auth.error }, { status: auth.status || 401 }), auth)

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const page = parseInt(searchParams.get("page") || "1")

    const server = await resolveServer(auth.apiKey)
    if (!server) return withRateLimit(NextResponse.json({ error: "Server not found" }, { status: 404 }), auth)

    try {
        const where = {
            serverId: server.id,
            type: "Ban Bolo",
            resolved: false
        }

        const [bolos, total] = await Promise.all([
            prisma.punishment.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: (page - 1) * limit,
                select: {
                    id: true,
                    userId: true,
                    moderatorId: true,
                    reason: true,
                    createdAt: true
                }
            }),
            prisma.punishment.count({ where })
        ])

        await logApiAccess(auth.apiKey, "PUBLIC_ACTIVE_BOLOS", `Server: ${server.name}, Count: ${total}`)

        return withRateLimit(NextResponse.json({
            bolos,
            total,
            pagination: { page, limit, totalPages: Math.ceil(total / limit) }
        }), auth)
    } catch (e) {
        console.error("Public Active BOLOs API Error:", e)
        return withRateLimit(NextResponse.json({ error: "Internal Error" }, { status: 500 }), auth)
    }
}
