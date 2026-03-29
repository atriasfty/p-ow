import { getSession } from "@/lib/auth-clerk"
import { clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { PrcClient } from "@/lib/prc"
import { prisma } from "@/lib/db"

export async function POST(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { prcApiKey, discordGuildId, initialConfig } = await req.json()

        if (!prcApiKey || !discordGuildId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // 0. Verify User Permissions in Guild (Security Step)
        try {
            const clerk = await clerkClient()
            const tokens = await clerk.users.getUserOauthAccessToken(session.user.id, "oauth_discord")
            const discordToken = tokens.data[0]?.token

            if (!discordToken) {
                return NextResponse.json({ error: "Your Discord account is not linked." }, { status: 400 })
            }

            const userGuildsRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
                headers: { Authorization: `Bearer ${discordToken}` }
            })

            if (!userGuildsRes.ok) throw new Error("Discord API error")
            const userGuilds = await userGuildsRes.json()
            const guild = userGuilds.find((g: any) => g.id === discordGuildId)

            if (!guild) {
                return NextResponse.json({ error: "You are not a member of this guild." }, { status: 403 })
            }

            const perms = BigInt(guild.permissions)
            const isAdmin = (perms & BigInt(0x8)) === BigInt(0x8) || (perms & BigInt(0x20)) === BigInt(0x20)

            if (!isAdmin) {
                return NextResponse.json({ error: "Unauthorized: Admin permissions required." }, { status: 403 })
            }
        } catch (e) {
            return NextResponse.json({ error: "Failed to verify your Discord permissions." }, { status: 500 })
        }

        // 1. Verify PRC again
        let serverName = ""
        try {
            const prcClient = new PrcClient(prcApiKey)
            const serverInfo = await prcClient.getServer()
            serverName = serverInfo.Name
        } catch (e) {
            return NextResponse.json({ error: "API Key validation failed during creation." }, { status: 400 })
        }

        // 2. Verify Discord again
        const botToken = process.env.DISCORD_BOT_TOKEN
        let guildName = ""
        try {
            const guildRes = await fetch(`https://discord.com/api/v10/guilds/${discordGuildId}`, {
                headers: { Authorization: `Bot ${botToken}` }
            })

            if (!guildRes.ok) {
                return NextResponse.json({ error: "Discord verification failed during creation." }, { status: 400 })
            }
            guildName = (await guildRes.json()).name
        } catch (e) {
            return NextResponse.json({ error: "Discord API error." }, { status: 500 })
        }

        // 3. Create Server & Member Transaction
        const result = await prisma.$transaction(async (tx: any) => {
            // Re-check duplicate inside transaction
            const existing = await tx.server.findFirst({
                where: {
                    OR: [
                        { discordGuildId: discordGuildId },
                        { apiUrl: prcApiKey }
                    ]
                }
            })

            if (existing) {
                throw new Error("This server is already linked.")
            }

            const newServer = await tx.server.create({
                data: {
                    name: serverName,
                    customName: `${guildName} Backend`,
                    apiUrl: prcApiKey,
                    discordGuildId: discordGuildId,
                    subscriptionPlan: "free", // Default to free tier
                    subscriberUserId: session.user.id, // Store creator as owner

                    // Initial Config
                    staffRoleId: initialConfig?.staffRoleId,
                    permLogChannelId: initialConfig?.logChannelId,
                    staffRequestChannelId: initialConfig?.logChannelId,
                    commandLogChannelId: initialConfig?.logChannelId,
                }
            })

            await tx.member.create({
                data: {
                    userId: session.user.id,
                    serverId: newServer.id,
                    discordId: session.user.discordId,
                    robloxId: session.user.robloxId,
                    robloxUsername: session.user.robloxUsername,
                    isAdmin: true // Creator is always admin
                }
            })

            return newServer
        })

        return NextResponse.json({ success: true, serverId: result.id })

    } catch (e: any) {
        console.error("Server Creation Error:", e)
        return NextResponse.json({ error: e.message || "Failed to create server." }, { status: 500 })
    }
}
