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
        orderBy: { createdAt: "desc" }
    })

    // Mask the secret key to prevent exposure in the dashboard after creation
    const maskedKeys = keys.map(k => ({
        ...k,
        key: `${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 4)}`
    }))

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
