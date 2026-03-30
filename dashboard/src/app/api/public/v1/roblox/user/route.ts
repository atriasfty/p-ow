import { getRobloxUser } from "@/lib/roblox"
import { validatePublicApiKey, withRateLimit, logApiAccess } from "@/lib/public-auth"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const auth = await validatePublicApiKey()
    if (!auth.valid) return withRateLimit(NextResponse.json({ error: auth.error }, { status: 401 }), auth)

    const { searchParams } = new URL(req.url)
    const username = searchParams.get("username")

    if (!username) return withRateLimit(NextResponse.json({ error: "Missing username" }, { status: 400 }), auth)

    try {
        const user = await getRobloxUser(username)
        if (!user) return withRateLimit(NextResponse.json({ error: "User not found" }, { status: 404 }), auth)

        await logApiAccess(auth.apiKey, "PUBLIC_ROBLOX_LOOKUP", `Username: ${username}`)
        return withRateLimit(NextResponse.json(user), auth)
    } catch (e) {
        console.error("Public Roblox API Error:", e)
        return withRateLimit(NextResponse.json({ error: "Internal Error" }, { status: 500 }), auth)
    }
}
