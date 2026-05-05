import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")
    if (!serverId) return NextResponse.json({ error: "Missing serverId" }, { status: 400 })

    // Verify the user is a member of this server
    const possibleIds = [session.user.id, session.user.discordId, session.user.robloxId].filter(Boolean) as string[]
    const member = await prisma.member.findFirst({
        where: {
            serverId,
            OR: [
                { userId: { in: possibleIds } },
                { discordId: session.user.discordId ?? undefined }
            ]
        },
        select: { roleId: true, isAdmin: true }
    })

    if (!member) return new NextResponse("Forbidden", { status: 403 })

    const automations = await prisma.automation.findMany({
        where: { serverId, trigger: "TOOLBOX_BUTTON", enabled: true },
        select: { id: true, name: true, conditions: true }
    })

    const visible = automations
        .filter(a => {
            try {
                const c = JSON.parse(a.conditions || "{}")
                const allowedRoleIds: string[] = Array.isArray(c.allowedRoleIds) ? c.allowedRoleIds : []
                if (allowedRoleIds.length === 0) return true
                if (member.isAdmin) return true
                return member.roleId ? allowedRoleIds.includes(member.roleId) : false
            } catch { return true }
        })
        .map(a => {
            let buttonColor = "#6366f1"
            try {
                const c = JSON.parse(a.conditions || "{}")
                if (c.buttonColor) buttonColor = c.buttonColor
            } catch {}
            return { id: a.id, name: a.name, buttonColor }
        })

    return NextResponse.json(visible)
}
