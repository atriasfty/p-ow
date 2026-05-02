import { getSession } from "@/lib/auth-clerk"
import { isServerAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { verifyCsrf } from "@/lib/auth-permissions"

// Schema validation could be added here (e.g. Zod) but keeping it simple for now

export async function GET(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")

    if (!serverId) return new NextResponse("Missing serverId", { status: 400 })

    // Check permissions (must be admin)
    if (!await isServerAdmin(session.user as any, serverId)) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    const automations = await prisma.automation.findMany({
        where: { serverId },
        orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(automations)
}

export async function POST(req: Request) {
    if (!verifyCsrf(req)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }

    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const body = await req.json()
        const { serverId, id, name, trigger, conditions, actions, enabled } = body

        if (!serverId || !name || !trigger) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Check permissions
        if (!await isServerAdmin(session.user as any, serverId)) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        if (id) {
            // Update
            const automation = await prisma.automation.updateMany({
                where: { id, serverId }, // Enforce tenant isolation to prevent IDOR
                data: {
                    name,
                    trigger,
                    conditions: typeof conditions === 'string' ? conditions : JSON.stringify(conditions),
                    actions: typeof actions === 'string' ? actions : JSON.stringify(actions),
                    enabled
                }
            })
            // Since updateMany returns a count, we need to fetch the updated record if we want to return it, or just return success
            return NextResponse.json({ success: automation.count > 0 })
        } else {
            // Check subscription automation limit
            const { checkLimit } = await import("@/lib/subscription")
            const { isServerFeatureEnabled } = await import("@/lib/feature-flags")

            const limitsEnabled = await isServerFeatureEnabled('AUTOMATIONS_LIMIT_CHECK', serverId)
            if (limitsEnabled) {
                const { allowed, current, max } = await checkLimit(serverId, 'automations')
                if (!allowed) {
                    return NextResponse.json({
                        error: `Automation limit reached (${current}/${max}). Upgrade your plan to create more automations.`,
                        upgradeRequired: true
                    }, { status: 403 })
                }
            }

            // Create
            const automation = await prisma.automation.create({
                data: {
                    serverId,
                    name,
                    trigger,
                    conditions: typeof conditions === 'string' ? conditions : JSON.stringify(conditions),
                    actions: typeof actions === 'string' ? actions : JSON.stringify(actions),
                    enabled: enabled ?? true
                }
            })
            return NextResponse.json(automation)
        }
    } catch (e) {
        console.error("Error saving automation:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    if (!verifyCsrf(req)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }

    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const body = await req.json()
        const { id, serverId } = body

        if (!id || !serverId) return NextResponse.json({ error: "Missing ID" }, { status: 400 })

        // Check permissions
        if (!await isServerAdmin(session.user as any, serverId)) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        await prisma.automation.deleteMany({
            where: { id, serverId } // Enforce tenant isolation
        })

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error("Error deleting automation:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
