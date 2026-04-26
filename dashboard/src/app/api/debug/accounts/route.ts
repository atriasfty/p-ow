
import { currentUser } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth-clerk"
import { isSuperAdmin } from "@/lib/admin"

// Debug endpoint to check what external accounts are linked
export async function GET() {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (!isSuperAdmin(session.user as any)) return new NextResponse("Forbidden", { status: 403 })

    const user = await currentUser()
    if (!user) return new NextResponse("Not logged in", { status: 401 })

    const accounts = user.externalAccounts.map(a => ({
        provider: a.provider,
        externalId: a.externalId,
        username: a.username,
        firstName: a.firstName,
        lastName: a.lastName,
        imageUrl: a.imageUrl
    }))

    return NextResponse.json({
        userId: user.id,
        externalAccounts: accounts,
        allProviders: user.externalAccounts.map(a => a.provider)
    }, { status: 200 })
}
