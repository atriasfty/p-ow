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

        let existingMember = await prisma.member.findFirst({
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
            // Backfill discordId and robloxId if missing
            const needsUpdate = existingMember.discordId !== discordId || (!existingMember.robloxId && robloxId)
            if (needsUpdate) {
                await prisma.member.update({
                    where: { id: existingMember.id },
                    data: {
                        discordId,
                        ...(robloxId && !existingMember.robloxId ? { robloxId } : {})
                    }
                })
            }
            return NextResponse.json({ success: true, discordId, updated: true })
        }

        // Do NOT create a new Member record here. Membership is granted via
        // Discord role auto-sync (handled by the bot) or by an admin manually
        // adding the user. Allowing self-creation here let any authenticated
        // user join any server and inherit DEFAULT_PERMISSIONS (which include
        // canUseToolbox), letting them execute PRC commands on that server.
        return NextResponse.json(
            { error: "Not a member of this server" },
            { status: 403 }
        )

    } catch (e) {
        console.error("[LINK] Error:", e)
        return NextResponse.json({ error: "Failed to link Discord" }, { status: 500 })
    }
}
