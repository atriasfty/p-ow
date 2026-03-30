import { PrcClient } from "@/lib/prc"
import { validatePublicApiKey, withRateLimit, resolveServer, logApiAccess } from "@/lib/public-auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    const auth = await validatePublicApiKey()
    if (!auth.valid) return withRateLimit(NextResponse.json({ error: auth.error }, { status: 401 }), auth)

    const { searchParams } = new URL(req.url)
    const serverName = searchParams.get("server")

    if (!serverName) return withRateLimit(NextResponse.json({ error: "Missing server name" }, { status: 400 }), auth)

    const body = await req.json().catch(() => ({}))
    const { command } = body

    if (!command) return withRateLimit(NextResponse.json({ error: "Missing 'command' in body" }, { status: 400 }), auth)

    const server = await resolveServer(auth.apiKey)
    if (!server) return withRateLimit(NextResponse.json({ error: "Server not found" }, { status: 404 }), auth)

    try {
        const client = new PrcClient(server.apiUrl)
        await client.executeCommand(command)

        await logApiAccess(auth.apiKey, "PUBLIC_COMMAND_EXECUTED", `Server: ${server.name}, Command: ${command}`)
        return withRateLimit(NextResponse.json({ success: true }), auth)
    } catch (e) {
        console.error("Public Command API Error:", e)
        return withRateLimit(NextResponse.json({ error: "Internal Error" }, { status: 500 }), auth)
    }
}
