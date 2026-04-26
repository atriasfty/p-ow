import { getSession } from "@/lib/auth-clerk"
import { isServerAdmin } from "@/lib/admin"
import { saveServerSettings, ServerSettings } from "@/lib/server-settings"
import { logAudit } from "@/lib/audit"
import { verifyCsrf } from "@/lib/auth-permissions"
import { NextResponse } from "next/server"

// PATCH /api/admin/server/settings — save a partial ServerSettings blob for a server
export async function PATCH(req: Request) {
    if (!verifyCsrf(req)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }

    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const body = await req.json()
        const { serverId, settings } = body as { serverId: string; settings: Partial<ServerSettings> }

        if (!serverId || !settings || typeof settings !== "object") {
            return NextResponse.json({ error: "Missing serverId or settings" }, { status: 400 })
        }

        // Auth: must be server admin
        const hasAccess = await isServerAdmin(session.user, serverId)
        if (!hasAccess) return new NextResponse("Forbidden", { status: 403 })

        // Save and return merged settings (saveServerSettings handles plan clamping)
        const merged = await saveServerSettings(serverId, settings)

        await logAudit(
            serverId,
            "SERVER_SETTINGS_UPDATED",
            `Updated behavior settings: ${Object.keys(settings).join(", ")}`,
            "DASHBOARD",
            session.user.id
        )

        return NextResponse.json({ success: true, settings: merged })
    } catch (e: any) {
        console.error("[SETTINGS PATCH]", e)
        return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 })
    }
}
