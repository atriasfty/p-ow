
import { getSession } from "@/lib/auth-clerk"
import { NextResponse } from "next/server"
import { isSuperAdmin } from "@/lib/admin"

// Debug endpoint to check current session data
export async function GET() {
    const session = await getSession()

    if (!session) {
        return NextResponse.json({ error: "Not logged in" }, { status: 401 })
    }

    if (!isSuperAdmin(session.user as any)) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    return NextResponse.json({
        user: session.user,
        hasDiscord: !!session.user.discordId,
        hasRoblox: !!session.user.robloxId
    })
}
