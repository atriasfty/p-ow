import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { AutomationEngine } from "@/lib/automation-engine"

export async function POST(
    req: Request,
    { params }: { params: Promise<{ automationId: string }> }
) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { automationId } = await params
    const body = await req.json()
    const { serverId } = body

    if (!serverId) return NextResponse.json({ error: "Missing serverId" }, { status: 400 })

    // Verify membership
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

    // Fetch and validate the automation
    const automation = await prisma.automation.findFirst({
        where: { id: automationId, serverId, trigger: "TOOLBOX_BUTTON", enabled: true }
    })

    if (!automation) return NextResponse.json({ error: "Automation not found" }, { status: 404 })

    // Re-check role visibility server-side
    try {
        const c = JSON.parse(automation.conditions || "{}")
        const allowedRoleIds: string[] = Array.isArray(c.allowedRoleIds) ? c.allowedRoleIds : []
        if (allowedRoleIds.length > 0 && !member.isAdmin) {
            if (!member.roleId || !allowedRoleIds.includes(member.roleId)) {
                return new NextResponse("Forbidden", { status: 403 })
            }
        }
    } catch {}

    await AutomationEngine.trigger("TOOLBOX_BUTTON", { serverId }, automation)

    return NextResponse.json({ success: true })
}
