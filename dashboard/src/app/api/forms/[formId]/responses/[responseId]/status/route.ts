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
    const { status } = await req.json() // "accepted" | "denied" | "completed"

    try {
        const form = await prisma.form.findUnique({
            where: { id: formId },
            include: { server: true }
        })

        if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 })

        // Auth check
        if (!await isServerAdmin(session.user as any, form.serverId)) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const response = await prisma.formResponse.findUnique({
            where: { id: responseId }
        })

        if (!response) return NextResponse.json({ error: "Response not found" }, { status: 404 })

        // Update status
        await prisma.formResponse.update({
            where: { id: responseId },
            data: { status }
        })

        // Handle Automated Acceptance
        if (status === "accepted" && form.isApplication && response.respondentId) {
            const clerk = await clerkClient()
            const user = await clerk.users.getUser(response.respondentId)
            
            const discordAccount = user.externalAccounts.find(a => a.provider === 'oauth_discord')
            const robloxAccount = user.externalAccounts.find(a => a.provider === 'oauth_roblox')

            if (!discordAccount || !robloxAccount) {
                return NextResponse.json({ 
                    success: true, 
                    warning: "User accepted but roles not given (Account not fully linked - Discord/Roblox missing)." 
                })
            }

            // 1. Grant Discord Role if configured
            if (form.acceptedRoleId) {
                await prisma.botQueue.create({
                    data: {
                        serverId: form.serverId,
                        type: "ROLE_ADD", // We need the bot to handle this type
                        targetId: discordAccount.externalId,
                        content: form.acceptedRoleId
                    }
                })
            }

            // 2. Send Congratulations
            if (form.congratsChannelId) {
                const message = {
                    content: `🎉 **Congratulations** to <@${discordAccount.externalId}>!`,
                    embeds: [{
                        title: "New Staff Member!",
                        description: `**${user.username || user.firstName}**'s application for **${form.title}** has been accepted!`,
                        color: 0x10b981,
                        thumbnail: { url: user.imageUrl },
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
