
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"
import { verifyCsrf } from "@/lib/auth-permissions"
import { getServerSettings } from "@/lib/server-settings"

// Approve LOA
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    if (!verifyCsrf(req)) {
        return new NextResponse("CSRF validation failed", { status: 403 })
    }

    try {
        const { id } = await params

        const loa = await prisma.leaveOfAbsence.findUnique({
            where: { id },
            include: { server: true }
        })
        if (!loa) {
            return NextResponse.json({ error: "LOA not found" }, { status: 404 })
        }

        const hasAccess = await isServerAdmin(session.user, loa.serverId)
        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        const [member, s] = await Promise.all([
            prisma.member.findFirst({
                where: { serverId: loa.serverId, userId: loa.userId }
            }),
            getServerSettings(loa.serverId)
        ])

        await prisma.leaveOfAbsence.update({
            where: { id },
            data: {
                status: "approved",
                robloxUsername: member?.robloxUsername || loa.robloxUsername,
                reviewedBy: session.user.robloxId || session.user.discordId || session.user.id,
                reviewedAt: new Date()
            }
        })

        // ── Discord side effects ──────────────────────────────────────────────
        // Assign the on-LOA role if configured
        if (loa.server.onLoaRoleId && member?.discordId) {
            await prisma.botQueue.create({
                data: {
                    serverId: loa.serverId,
                    type: "ROLE_ADD",
                    targetId: member.discordId,
                    content: loa.server.onLoaRoleId
                }
            })
        }

        // DM the staff member if configured
        if (s.loaApprovalDmNotify && member?.discordId) {
            await prisma.botQueue.create({
                data: {
                    serverId: loa.serverId,
                    type: "DM",
                    targetId: member.discordId,
                    content: JSON.stringify({
                        embeds: [{
                            title: "LOA Request Approved",
                            description: `Your Leave of Absence request for **${loa.server.customName || loa.server.name}** has been approved.`,
                            color: 0x10b981,
                            fields: [
                                { name: "Start Date", value: loa.startDate.toLocaleDateString(), inline: true },
                                { name: "End Date", value: loa.endDate.toLocaleDateString(), inline: true }
                            ]
                        }]
                    })
                }
            })
        }

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error("LOA approve error:", e)
        return NextResponse.json({ error: "Failed to approve LOA" }, { status: 500 })
    }
}
