import { prisma } from "@/lib/db"
import { validatePublicApiKey, withRateLimit, resolveServer, logApiAccess } from "@/lib/public-auth"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const auth = await validatePublicApiKey()
    if (!auth.valid) return withRateLimit(NextResponse.json({ error: auth.error }, { status: auth.status || 401 }), auth)

    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type")

    const server = await resolveServer(auth.apiKey)
    if (!server) return withRateLimit(NextResponse.json({ error: "Server not found" }, { status: 404 }), auth)

    try {
        const where: any = { serverId: server.id }
        if (type) where.type = type

        const logs = await prisma.log.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 100
        })

        await logApiAccess(auth.apiKey, "PUBLIC_LOGS_COLLECTED", `Server: ${server.name}`)
        return withRateLimit(NextResponse.json(logs), auth)
    } catch (e) {
        console.error("Public Logs API Error:", e)
        return withRateLimit(NextResponse.json({ error: "Internal Error" }, { status: 500 }), auth)
    }
}
