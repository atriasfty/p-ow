import { getSession } from "@/lib/auth-clerk"
import { isSuperAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { verifyCsrf } from "@/lib/auth-permissions"

export async function POST(req: Request) {
    if (!verifyCsrf(req)) return new NextResponse("Forbidden", { status: 403 })
    const session = await getSession()
    if (!session || !isSuperAdmin(session.user as any)) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    try {
        const { serverId, plan } = await req.json()

        if (!serverId || !["free", "pow-pro", "pow-max"].includes(plan)) {
            return new NextResponse("Invalid request data", { status: 400 })
        }

        const updatedServer = await prisma.server.update({
            where: { id: serverId },
            data: { subscriptionPlan: plan }
        })

        return NextResponse.json({ success: true, server: updatedServer })
    } catch (error) {
        console.error("Superadmin subscription update error:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
