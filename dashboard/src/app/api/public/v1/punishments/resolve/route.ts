import { prisma } from "@/lib/db"
import { validatePublicApiKey, withRateLimit, logApiAccess } from "@/lib/public-auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    const auth = await validatePublicApiKey()
    if (!auth.valid) return withRateLimit(NextResponse.json({ error: auth.error }, { status: 401 }), auth)

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return withRateLimit(NextResponse.json({ error: "Missing punishment ID" }, { status: 400 }), auth)

    try {
        const punishment = await prisma.punishment.update({
            where: { id },
            data: { resolved: true }
        })

        await logApiAccess(auth.apiKey, "PUBLIC_PUNISHMENT_RESOLVED", `ID: ${id}`)
        return withRateLimit(NextResponse.json({ success: true, id: punishment.id }), auth)
    } catch (e) {
        console.error("Public Punishment Resolve API Error:", e)
        return withRateLimit(NextResponse.json({ error: "Internal Error or Invalid ID" }, { status: 500 }), auth)
    }
}
