import { prisma } from "@/lib/db"
import { validatePublicApiKey, withRateLimit, logApiAccess, resolveServer } from "@/lib/public-auth"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const auth = await validatePublicApiKey()
    if (!auth.valid) return withRateLimit(NextResponse.json({ error: auth.error }, { status: auth.status || 401 }), auth)

    try {
        const server = await resolveServer(auth.apiKey)
        if (!server) return withRateLimit(NextResponse.json({ error: "Server not found" }, { status: 404 }), auth)

        await logApiAccess(auth.apiKey, "PUBLIC_SERVER_LIST_FETCHED")

        // Return as an array to maintain API backwards compatibility for existing clients
        return withRateLimit(NextResponse.json([{
            id: server.id,
            name: server.name,
            customName: server.customName,
            createdAt: server.createdAt
        }]), auth)
    } catch (e) {
        console.error("Public Server List API Error:", e)
        return withRateLimit(NextResponse.json({ error: "Internal Error" }, { status: 500 }), auth)
    }
}
