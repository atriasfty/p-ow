import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ formId: string, responseId: string }> }
) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { formId, responseId } = await params
    const { status, reason } = await req.json() // "accepted" | "denied" | "completed"

    try {
        const form = await prisma.form.findUnique({
            where: { id: formId },
            include: { server: true }
        })

        if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 })

        if (!await isServerAdmin(session.user as any, form.serverId)) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const response = await prisma.formResponse.findUnique({
            where: { id: responseId }
        })

        if (!response) return NextResponse.json({ error: "Response not found" }, { status: 404 })
        if (response.formId !== formId) return NextResponse.json({ error: "Response not found" }, { status: 404 })

        await prisma.formResponse.update({
            where: { id: responseId },
            data: { status }
        })

        if ((status === "accepted" || status === "denied") && form.isApplication && response.respondentId) {
            const accepted = status === "accepted"

            let discordId: string | null = null
            let displayName = "Unknown Applicant"

            try {
                const clerk = await clerkClient()
                const user = await clerk.users.getUser(response.respondentId)
                const discordAccount = user.externalAccounts.find(a =>
                    a.provider === "oauth_discord" || a.provider === "discord"
                )
                const robloxAccount = user.externalAccounts.find(a =>
                    a.provider === "oauth_custom_roblox" || a.provider === "oauth_roblox" || a.provider === "roblox"
                )
                discordId = discordAccount?.externalId ?? null
                displayName = robloxAccount?.username || user.username || displayName
            } catch (e) {
                console.error("[FORM STATUS] Failed to fetch user from Clerk:", e)
            }

            // Grant Discord role if accepted and configured
            if (accepted && form.acceptedRoleId && discordId) {
                await prisma.botQueue.create({
                    data: {
                        serverId: form.serverId,
                        type: "ROLE_ADD",
                        targetId: discordId,
                        content: form.acceptedRoleId
                    }
                })
            }

            // Send congrats/denial embed — decoupled from role requirement
            if (form.congratsChannelId) {
                const mention = discordId ? `<@${discordId}>` : displayName
                const decisionReason = (reason as string | undefined)?.trim() ||
                    (accepted ? "No reason provided." : "No reason given.")

                const message = {
                    embeds: [{
                        title: accepted ? "🎉 Application Accepted" : "❌ Application Denied",
                        description: `${mention}'s application for **${form.title}** has been **${accepted ? "accepted" : "denied"}**.`,
                        color: accepted ? 0x10b981 : 0xef4444,
                        fields: [
                            { name: "Reason", value: decisionReason, inline: false },
                            { name: "Reviewed By", value: session.user.name || "Staff", inline: true }
                        ],
                        timestamp: new Date().toISOString()
                    }]
                }

                await prisma.botQueue.create({
                    data: {
                        serverId: form.serverId,
                        type: "MESSAGE",
                        targetId: form.congratsChannelId,
                        content: JSON.stringify(message)
                    }
                })
            }
        }

        return NextResponse.json({ success: true })
    } catch (e: any) {
        console.error("[FORM STATUS PATCH]", e)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
