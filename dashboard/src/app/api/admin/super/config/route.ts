import { getSession } from "@/lib/auth-clerk"
import { isSuperAdmin } from "@/lib/admin"
import { verifyCsrf } from "@/lib/auth-permissions"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    if (!verifyCsrf(req)) {
        return new NextResponse("CSRF Token Missing or Invalid", { status: 403 })
    }

    const session = await getSession()
    if (!session || !isSuperAdmin(session.user as any)) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    try {
        const { key, value } = await req.json()

        if (!key || typeof value !== 'string') {
            return new NextResponse("Invalid payload", { status: 400 })
        }

        // Upsert configuration
        const config = await prisma.config.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        })

        return NextResponse.json({ success: true, config })
    } catch (e) {
        console.error("Superadmin config POST error:", e)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}

export async function DELETE(req: Request) {
    if (!verifyCsrf(req)) {
        return new NextResponse("CSRF Token Missing or Invalid", { status: 403 })
    }

    const session = await getSession()
    if (!session || !isSuperAdmin(session.user as any)) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const key = searchParams.get("key")

        if (!key) {
            return new NextResponse("Missing key", { status: 400 })
        }

        await prisma.config.delete({
            where: { key }
        })

        return NextResponse.json({ success: true })
    } catch (e: any) {
        if (e.code === 'P2025') {
            return new NextResponse("Config not found", { status: 404 })
        }
        console.error("Superadmin config DELETE error:", e)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
