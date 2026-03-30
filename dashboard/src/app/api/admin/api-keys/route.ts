import { prisma } from "@/lib/db"
import { getSession } from "@/lib/auth-clerk"
import { isServerAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"
import { verifyCsrf } from "@/lib/auth-permissions"
import crypto from "crypto"

export async function GET(req: Request) {
    const session = await getSession()
    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")

    // If serverId is provided, check permissions. 
    // If not, only superadmins can list all keys (or we return empty for regular users)
    if (serverId) {
        if (!await isServerAdmin(session?.user as any, serverId)) {
            return new NextResponse("Unauthorized", { status: 401 })
        }
    } else {
        // Only allow superadmins to see all keys
        const { isSuperAdmin } = await import("@/lib/admin")
        if (!session?.user || !isSuperAdmin(session.user as any)) {
            return new NextResponse("Unauthorized: Missing serverId", { status: 401 })
        }
    }

    const keys = await prisma.apiKey.findMany({
        where: serverId ? { serverId } : {},
        orderBy: { createdAt: "desc" },
        include: { server: { select: { subscriptionPlan: true } } }
    })

    // Mask the secret key to prevent exposure in the dashboard after creation
    const maskedKeys = keys.map(k => {
        const plan = k.server?.subscriptionPlan || (k.serverId ? "free" : "pow-max")
        const limits: Record<string, number> = {
            "free": 250,
            "pow-pro": 5000,
            "pow-max": Infinity
        }
        const maxDaily = limits[plan] || 250

        return {
            ...k,
            dailyLimit: maxDaily, // Override DB fallback value with the dynamically bound plan limit
            key: `${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 4)}`
        }
    })

    if (searchParams.get("includeAnalytics") === "true") {
        let analytics: { date: string, count: number }[] = []
        if (keys.length > 0) {
            const sevenDaysAgo = new Date()
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

            const logs = await prisma.securityLog.findMany({
                where: {
                    event: { startsWith: 'PUBLIC_' },
                    createdAt: { gte: sevenDaysAgo },
                    OR: keys.map(k => ({ details: { contains: k.id } }))
                },
                select: { createdAt: true }
            })

            // Group by day (MM/DD format)
            const dailyCounts: Record<string, number> = {}
            for (let i = 6; i >= 0; i--) {
                const d = new Date()
                d.setDate(d.getDate() - i)
                const dateStr = `${d.getMonth() + 1}/${d.getDate()}`
                dailyCounts[dateStr] = 0
            }

            logs.forEach(log => {
                const d = log.createdAt
                const dateStr = `${d.getMonth() + 1}/${d.getDate()}`
                if (dailyCounts[dateStr] !== undefined) {
                    dailyCounts[dateStr]++
                }
            })

            analytics = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }))
        }

        return NextResponse.json({ keys: maskedKeys, analytics })
    }

    return NextResponse.json(maskedKeys)
}

export async function POST(req: Request) {
    if (!verifyCsrf(req)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }
    const session = await getSession()
    const { name, serverId } = await req.json()

    // Check access if serverId is provided
    if (serverId) {
        if (!await isServerAdmin(session?.user as any, serverId)) {
            return new NextResponse("Unauthorized", { status: 401 })
        }
    } else {
        // Only superadmins can create global/unlinked keys
        const { isSuperAdmin } = await import("@/lib/admin")
        if (!session?.user || !isSuperAdmin(session.user as any)) {
            return new NextResponse("Unauthorized: Admin access to a server required", { status: 401 })
        }
    }

    if (!name) return new NextResponse("Name is required", { status: 400 })

    // Generate a cryptographically secure key
    const rawKey = crypto.randomBytes(24).toString("hex")
    const key = `pow_${rawKey}`

    const apiKey = await prisma.apiKey.create({
        data: {
            name,
            key,
            serverId: serverId || null,
            enabled: true
        }
    })

    return NextResponse.json(apiKey)
}

export async function DELETE(req: Request) {
    if (!verifyCsrf(req)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }
    const session = await getSession()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    const serverId = searchParams.get("serverId")

    // If serverId is provided, verify they are admin of that server
    if (serverId) {
        if (!await isServerAdmin(session?.user as any, serverId)) {
            return new NextResponse("Unauthorized", { status: 401 })
        }
    } else {
        // If no serverId, only superadmin can delete
        const { isSuperAdmin } = await import("@/lib/admin")
        if (!session?.user || !isSuperAdmin(session.user as any)) {
            return new NextResponse("Unauthorized", { status: 401 })
        }
    }

    if (!id) return new NextResponse("ID is required", { status: 400 })

    await prisma.apiKey.deleteMany({
        where: { id, ...(serverId ? { serverId } : {}) }
    })

    return NextResponse.json({ success: true })
}

export async function PATCH(req: Request) {
    if (!verifyCsrf(req)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }
    const session = await getSession()
    const { id, serverId, enabled, rateLimit, dailyLimit } = await req.json()

    if (serverId) {
        if (!await isServerAdmin(session?.user as any, serverId)) {
            return new NextResponse("Unauthorized", { status: 401 })
        }
    } else {
        const { isSuperAdmin } = await import("@/lib/admin")
        if (!session?.user || !isSuperAdmin(session.user as any)) {
            return new NextResponse("Unauthorized", { status: 401 })
        }
    }

    if (!id) return new NextResponse("ID is required", { status: 400 })

    const data: any = {}
    if (typeof enabled === "boolean") data.enabled = enabled
    if (typeof rateLimit === "number") data.rateLimit = rateLimit
    if (typeof dailyLimit === "number") data.dailyLimit = dailyLimit

    const apiKey = await prisma.apiKey.updateMany({
        where: { id, ...(serverId ? { serverId } : {}) },
        data
    })

    return NextResponse.json(apiKey)
}
