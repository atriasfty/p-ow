import { prisma } from "@/lib/db"
import { validatePublicApiKey, withRateLimit, resolveServer, logApiAccess } from "@/lib/public-auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    const auth = await validatePublicApiKey()
    if (!auth.valid) return withRateLimit(NextResponse.json({ error: auth.error }, { status: 401 }), auth)

    const { searchParams } = new URL(req.url)
    const body = await req.json().catch(() => ({}))
    const { userId } = body

    if (!userId) return withRateLimit(NextResponse.json({ error: "Missing userId" }, { status: 400 }), auth)

    const server = await resolveServer(auth.apiKey)
    if (!server) return withRateLimit(NextResponse.json({ error: "Server not found" }, { status: 404 }), auth)

    // Use a transaction to prevent race conditions
    const shift = await prisma.$transaction(async (tx) => {
        // Find existing active shift
        const existing = await tx.shift.findFirst({
            where: { userId, serverId: server.id, endTime: null }
        })

        if (existing) {
            throw new Error("Shift already active")
        }

        return await tx.shift.create({
            data: {
                userId,
                serverId: server.id,
                startTime: new Date()
            }
        })
    }).catch((e: any) => {
        if (e.message === "Shift already active") {
            return { error: e.message }
        }
        throw e
    })

    if ('error' in shift) {
        return withRateLimit(NextResponse.json({ error: shift.error }, { status: 400 }), auth)
    }

    await logApiAccess(auth.apiKey, "PUBLIC_SHIFT_STARTED", `User: ${userId}, Server: ${server.name}`)
    return withRateLimit(NextResponse.json({ success: true, shift }), auth)
}
