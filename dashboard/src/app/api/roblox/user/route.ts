// @ts-ignore
import { NextResponse } from "next/server"
import { getRobloxUser, getRobloxUserById } from "@/lib/roblox"
import { checkSecurity } from "@/lib/security"

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const username = searchParams.get("username") || searchParams.get("query")
    const requestId = crypto.randomUUID()

    console.log(`[${requestId}] GET /api/roblox/user - username: ${username}`)

    if (!username) {
        console.warn(`[${requestId}] Missing username parameter`)
        return new NextResponse("Missing username", { status: 400 })
    }

    const securityBlock = await checkSecurity(req)
    if (securityBlock) {
        console.warn(`[${requestId}] Security check blocked request`)
        return securityBlock
    }

    try {
        let user
        // Check if input is a numeric ID
        if (/^\d+$/.test(username)) {
            console.log(`[${requestId}] Detected numeric ID: ${username}`)
            user = await getRobloxUserById(parseInt(username))
        } else {
            console.log(`[${requestId}] Looking up username: ${username}`)
            user = await getRobloxUser(username)
        }

        if (!user) {
            console.warn(`[${requestId}] User not found: ${username}`)
            return new NextResponse("Not Found", { status: 404 })
        }

        console.log(`[${requestId}] Successfully retrieved user: ${user.name} (ID: ${user.id})`)
        return NextResponse.json(user)
    } catch (e) {
        console.error(`[${requestId}] Roblox API Error:`, e)
        return new NextResponse("Error", { status: 500 })
    }
}
