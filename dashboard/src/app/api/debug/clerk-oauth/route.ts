import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-clerk";
import { isSuperAdmin } from "@/lib/admin";

export async function GET(req: Request) {
    try {
        const session = await getSession()
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (!isSuperAdmin(session.user as any)) return new NextResponse("Forbidden", { status: 403 })

        const client = await clerkClient()
        const url = new URL(req.url)
        const userId = url.searchParams.get("userId")
        if (!userId) return new NextResponse("No userId", { status: 400 })

        const provider = "oauth_discord"
        const tokens = await client.users.getUserOauthAccessToken(userId, provider)
        return NextResponse.json({ tokens: tokens.data })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
