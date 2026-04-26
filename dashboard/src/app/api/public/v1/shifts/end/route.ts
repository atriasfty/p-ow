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

    const isMember = await prisma.member.findFirst({ where: { userId, serverId: server.id } })
    if (!isMember) return withRateLimit(NextResponse.json({ error: "User is not a member of this server" }, { status: 403 }), auth)

    const activeShift = await prisma.shift.findFirst({
        where: { userId, serverId: server.id, endTime: null }
    })

    if (!activeShift) return withRateLimit(NextResponse.json({ error: "No active shift found" }, { status: 404 }), auth)

    const endTime = new Date()
    const duration = Math.floor((endTime.getTime() - activeShift.startTime.getTime()) / 1000)

    const updated = await prisma.shift.update({
        where: { id: activeShift.id },
        data: { endTime, duration }
    })

    await logApiAccess(auth.apiKey, "PUBLIC_SHIFT_ENDED", `User: ${userId}, Server: ${server.name}, Duration: ${duration}s`)
    return withRateLimit(NextResponse.json({ success: true, shift: updated }), auth)
}
