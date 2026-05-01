import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import {
    linkSubscriptionToServer,
    unlinkSubscription,
    getServersForLinking,
    getUserPlan
} from "@/lib/subscription"
import { isSuperAdmin } from "@/lib/admin"
import { verifyCsrf } from "@/lib/auth-permissions"

// Get servers available for linking
export async function GET() {
    try {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const userPlan = await getUserPlan(userId)
        const servers = await getServersForLinking(userId)
        const isSuper = isSuperAdmin({ id: userId } as any)

        return NextResponse.json({
            userPlan: isSuper ? 'pow-max' : userPlan.plan,
            linkedServerId: userPlan.linkedServerId,
            servers,
            isSuperAdmin: isSuper
        })
    } catch (error) {
        console.error("[Subscription Link] GET Error:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}

// Link subscription to a server
export async function POST(req: Request) {
    if (!verifyCsrf(req)) {
        return new NextResponse("Forbidden: CSRF validation failed", { status: 403 })
    }

    try {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { serverId, plan } = await req.json()

        if (!serverId || !plan) {
            return NextResponse.json({ error: "Missing serverId or plan" }, { status: 400 })
        }

        if (!['pow-pro', 'pow-max'].includes(plan)) {
            return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
        }

        const isSuper = isSuperAdmin({ id: userId } as any)

        // Verify user has this subscription (or is superadmin)
        if (!isSuper) {
            const userPlan = await getUserPlan(userId)
            
            // If they are linking pow-pro or pow-max, they must own it.
            if (userPlan.plan !== plan && userPlan.plan !== 'pow-max') {
                return NextResponse.json({ error: `You do not have an active ${plan} subscription to link.` }, { status: 403 })
            }
        }

        const result = await linkSubscriptionToServer(userId, serverId, plan as any)

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[Subscription Link] POST Error:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}

// Unlink subscription from server
export async function DELETE(req: Request) {
    if (!verifyCsrf(req)) {
        return new NextResponse("Forbidden: CSRF validation failed", { status: 403 })
    }

    try {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const serverId = searchParams.get("serverId")

        if (serverId) {
            // Superadmin or normal user specifically unlinking one server
            const { prisma } = await import("@/lib/db")
            await prisma.server.update({
                where: { id: serverId, subscriberUserId: userId },
                data: {
                    subscriberUserId: null,
                    subscriptionPlan: null
                }
            }).catch(() => {}) // Ignore if not found or not owned by them
        } else {
            // Legacy behavior: unlink all (used by normal users)
            await unlinkSubscription(userId)
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[Subscription Link] DELETE Error:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}