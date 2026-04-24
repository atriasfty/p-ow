import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { verifyCsrf } from "@/lib/auth-permissions"

// Ensure user's Discord ID is saved to their Member records
export async function POST(req: Request) {
    if (!verifyCsrf(req)) return new NextResponse("Forbidden", { status: 403 })
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { serverId } = await req.json()

        if (!serverId) {
            return NextResponse.json({ error: "Missing serverId" }, { status: 400 })
        }

        const discordId = session.user.discordId
        const robloxId = session.user.robloxId
        const clerkId = session.user.id

        if (!discordId) {
            return NextResponse.json({ error: "Discord not linked" }, { status: 400 })
        }

        // Try to find existing member by multiple methods:
        // 1. By Clerk User ID
        // 2. By Roblox ID (some older code might use this)
        // 3. By Discord ID (already linked)

        const existingMember = await prisma.member.findFirst({
            where: {
                serverId,
                OR: [
                    { userId: clerkId },
                    { userId: robloxId || "" },
                    { discordId: discordId }
                ]
            }
        })

        if (existingMember) {
            // Update Discord ID
            if (existingMember.discordId !== discordId) {
                await prisma.member.update({
                    where: { id: existingMember.id },
                    data: { discordId }
                })
            }
            return NextResponse.json({ success: true, discordId, updated: true })
        }

        // No existing member found - create one
        const newMember = await prisma.member.create({
            data: {
                userId: clerkId,
                serverId,
                discordId,
                isAdmin: false
            }
        })

        return NextResponse.json({ success: true, discordId, created: true })

    } catch (e) {
        console.error("[LINK] Error:", e)
        return NextResponse.json({ error: "Failed to link Discord" }, { status: 500 })
    }
}
