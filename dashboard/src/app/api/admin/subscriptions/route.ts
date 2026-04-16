import { NextResponse } from "next/server"
import { verifyCsrf } from "@/lib/auth-permissions"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/db"
import {
    adminGrantServerPlan,
    adminGrantUserPlan
} from "@/lib/subscription"
import { isSuperAdmin } from "@/lib/admin"

// Get all servers with their subscription status
export async function GET() {
    try {
        const { userId } = await auth()
        if (!userId || !isSuperAdmin({ id: userId } as any)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        const servers = await prisma.server.findMany({
            select: {
                id: true,
                name: true,
                customName: true,
                subscriptionPlan: true,
                subscriberUserId: true,
                _count: {
                    select: { members: true, forms: true }
                }
            },
            orderBy: { name: 'asc' }
        })

        return NextResponse.json({
            servers: servers.map((s: any) => ({
                id: s.id,
                name: s.customName || s.name,
                plan: s.subscriptionPlan || 'free',
                subscriberUserId: s.subscriberUserId,
                memberCount: s._count.members,
                formCount: s._count.forms
            }))
        })
    } catch (error) {
        console.error("[Admin Subscriptions] GET Error:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}

// Grant/revoke subscription
export async function POST(req: Request) {
    if (!verifyCsrf(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    try {
        const { userId } = await auth()
        if (!userId || !isSuperAdmin({ id: userId } as any)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        const { type, targetId, plan } = await req.json()

        if (!type || !targetId) {
            return NextResponse.json({ error: "Missing type or targetId" }, { status: 400 })
        }

        if (type === 'server') {
            if (!['free', 'pow-pro', 'pow-max'].includes(plan)) {
                return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
            }

            const result = await adminGrantServerPlan(userId, targetId, plan)
            if (!result.success) {
                return NextResponse.json({ error: result.error }, { status: 400 })
            }
        } else if (type === 'user') {
            if (!['free', 'pow-pro-user'].includes(plan)) {
                return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
            }

            const result = await adminGrantUserPlan(userId, targetId, plan)
            if (!result.success) {
                return NextResponse.json({ error: result.error }, { status: 400 })
            }
        } else {
            return NextResponse.json({ error: "Invalid type" }, { status: 400 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[Admin Subscriptions] POST Error:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}
