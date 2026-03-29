import { getSession } from "@/lib/auth-clerk"
import { clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { PrcClient } from "@/lib/prc"
import { prisma } from "@/lib/db"

export async function POST(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { prcApiKey, discordGuildId } = await req.json()

        if (!prcApiKey || !discordGuildId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // 0. Verify User Permissions in Guild
        // We must ensure the user has Manage Guild or Administrator permissions in the target guild
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
                return NextResponse.json({ error: "You need Administrator or Manage Server permissions in this guild." }, { status: 403 })
            }
        } catch (e) {
            console.error("Discord verification failed:", e)
            return NextResponse.json({ error: "Failed to verify your Discord permissions." }, { status: 500 })
        }

        // 0.1 Check if server already exists
        const existingServer = await prisma.server.findFirst({
            where: {
                OR: [
                    { discordGuildId: discordGuildId },
                    { apiUrl: prcApiKey }
                ]
            }
        })

        if (existingServer) {
            return NextResponse.json({ error: "This Discord Server or PRC API Key is already linked to a POW Dashboard." }, { status: 400 })
        }

        // 1. Verify PRC API Key
        let prcValid = false
        let serverName = ""
        try {
            const prcClient = new PrcClient(prcApiKey)
            const serverInfo = await prcClient.getServer()
            prcValid = true
            serverName = serverInfo.Name
        } catch (e) {
            return NextResponse.json({ error: "Invalid PRC API Key or server is offline." }, { status: 400 })
        }

        // 2. Verify Discord Bot Presence & Permissions
        let botInGuild = false
        let guildName = ""
        let channels: any[] = []
        let roles: any[] = []
        const botToken = process.env.DISCORD_BOT_TOKEN

        if (!botToken) {
            return NextResponse.json({ error: "System Configuration Error: Missing Bot Token" }, { status: 500 })
        }

        try {
            // Get Bot's Guilds to check permissions efficiently
            const botGuildsRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
                headers: { Authorization: `Bot ${botToken}` }
            })
            
            if (!botGuildsRes.ok) throw new Error("Could not fetch bot guilds")
            const botGuilds = await botGuildsRes.json()
            const botGuildEntry = botGuilds.find((g: any) => g.id === discordGuildId)

            if (!botGuildEntry) {
                return NextResponse.json({ error: "The POW Discord Bot is not present in that Guild." }, { status: 400 })
            }

            // Check Permissions: Administrator (0x8) or Manage Roles (0x10000000)
            const botPerms = BigInt(botGuildEntry.permissions)
            const hasManageRoles = (botPerms & BigInt(0x8)) === BigInt(0x8) || (botPerms & BigInt(0x10000000)) === BigInt(0x10000000)
            
            if (!hasManageRoles) {
                return NextResponse.json({ error: "The Bot is missing 'Manage Roles' permission. Please update its role and try again." }, { status: 400 })
            }

            botInGuild = true
            guildName = botGuildEntry.name

            // Fetch Channels & Roles for Initial Setup
            const [chanRes, roleRes] = await Promise.all([
                fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/channels`, { headers: { Authorization: `Bot ${botToken}` } }),
                fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/roles`, { headers: { Authorization: `Bot ${botToken}` } })
            ])

            if (chanRes.ok) {
                const allChans = await chanRes.json()
                channels = allChans
                    .filter((c: any) => c.type === 0) // Text channels only
                    .map((c: any) => ({ id: c.id, name: c.name }))
            }
            if (roleRes.ok) {
                const allRoles = await roleRes.json()
                roles = allRoles
                    .filter((r: any) => r.name !== "@everyone" && !r.managed)
                    .map((r: any) => ({ id: r.id, name: r.name, color: r.color }))
            }

        } catch (e) {
            console.error("Bot verification failed:", e)
            return NextResponse.json({ error: "Failed to verify Discord Bot presence and permissions." }, { status: 500 })
        }

        return NextResponse.json({
            prcValid,
            serverName,
            botInGuild,
            guildName,
            availableChannels: channels,
            availableRoles: roles
        })

    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 })
    }
}
