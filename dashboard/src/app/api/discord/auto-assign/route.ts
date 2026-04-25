import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { verifyCsrf } from "@/lib/auth-permissions"

// Viewer permissions for staff role (no panel role)
const VIEWER_PERMISSIONS = {
    canShift: false,
    canViewOtherShifts: true,
    canViewLogs: true,
    canViewPunishments: true,
    canIssueWarnings: false,
    canKick: false,
    canBan: false,
    canBanBolo: false,
    canUseToolbox: false,
    canManageBolos: false,
    canRequestLoa: false,
    canViewQuota: true,
    canUseAdminCommands: false,
    canAccessAdmin: false
}

// Auto-assign panel role based on Discord roles
// Returns permissions for the user based on their role
export async function POST(req: Request) {
    if (!verifyCsrf(req)) return new NextResponse("CSRF verification failed", { status: 403 })
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { serverId } = await req.json()

        if (!serverId) {
            return NextResponse.json({ error: "Missing serverId" }, { status: 400 })
        }

        // Get server with Discord Guild ID
        const server = await prisma.server.findUnique({
            where: { id: serverId }
        })

        if (!server) {
            return NextResponse.json({ error: "Server not found" }, { status: 404 })
        }

        const botToken = server?.customBotEnabled && server?.customBotToken ? server.customBotToken : process.env.DISCORD_BOT_TOKEN
        if (!botToken) {
            return NextResponse.json({ error: "Bot token not configured" }, { status: 500 })
        }

        // Use server-specific guild ID or fallback to global env var
        const discordGuildId = server.discordGuildId || process.env.GUILD_ID

        if (!discordGuildId) {
            return NextResponse.json({ error: "Discord Guild not configured" }, { status: 400 })
        }

        // Get user's Discord ID from Clerk metadata
        const discordId = session.user.discordId
        if (!discordId) {
            return NextResponse.json({ error: "Discord not linked to account" }, { status: 400 })
        }

        // Fetch user's roles in the guild via Discord API
        const guildMemberRes = await fetch(
            `https://discord.com/api/v10/guilds/${discordGuildId}/members/${discordId}`,
            {
                headers: {
                    Authorization: `Bot ${botToken}`
                }
            }
        )

        if (!guildMemberRes.ok) {
            if (guildMemberRes.status === 404) {
                return NextResponse.json({ noAccess: true, message: "User not in Discord server" })
            }
            return NextResponse.json({ error: "Failed to fetch Discord member" }, { status: 500 })
        }

        const guildMember = await guildMemberRes.json()
        const userDiscordRoles: string[] = guildMember.roles || []

        // =====================================
        // 1. CHECK FOR TERMINATED ROLE - REMOVE FROM SERVER
        // =====================================
        if (server.terminatedRoleId && userDiscordRoles.includes(server.terminatedRoleId)) {
            try {
                // Remove member from this server's member list
                await prisma.member.deleteMany({
                    where: {
                        userId: session.user.id,
                        serverId: server.id
                    }
                })
            } catch (e) {
                console.error("Failed to remove member for termination:", e)
            }
            return NextResponse.json({
                terminated: true,
                message: "Your access to this server has been terminated."
            })
        }

        // =====================================
        // 2. CHECK FOR SUSPENDED ROLE - BLOCK ACCESS
        // =====================================
        if (server.suspendedRoleId && userDiscordRoles.includes(server.suspendedRoleId)) {
            return NextResponse.json({
                suspended: true,
                message: "Your account is suspended."
            })
        }

        // =====================================
        // 3. CHECK FOR PANEL ROLES - FULL ACCESS
        // =====================================
        const panelRoles = await prisma.role.findMany({
            where: {
                serverId,
                discordRoleId: { not: null }
            }
        })

        // Fetch guild roles for hierarchy
        const guildRolesRes = await fetch(
            `https://discord.com/api/v10/guilds/${discordGuildId}/roles`,
            { headers: { Authorization: `Bot ${botToken}` } }
        )

        let rolePositionMap = new Map<string, number>()
        if (guildRolesRes.ok) {
            const guildRoles: { id: string; position: number }[] = await guildRolesRes.json()
            rolePositionMap = new Map(guildRoles.map(r => [r.id, r.position]))
        }

        // Find best matching panel role
        let bestMatch: { role: typeof panelRoles[0]; position: number } | null = null

        for (const panelRole of panelRoles) {
            if (!panelRole.discordRoleId) continue
            if (userDiscordRoles.includes(panelRole.discordRoleId)) {
                const position = rolePositionMap.get(panelRole.discordRoleId) || 0
                if (!bestMatch || position > bestMatch.position) {
                    bestMatch = { role: panelRole, position }
                }
            }
        }

        if (bestMatch) {
            // User has a panel role - assign and return permissions
            const userId = session.user.id
            await prisma.member.upsert({
                where: { userId_serverId: { userId, serverId } },
                update: { roleId: bestMatch.role.id, discordId },
                create: { userId, serverId, discordId, roleId: bestMatch.role.id, isAdmin: false }
            })

            return NextResponse.json({
                success: true,
                assigned: true,
                roleName: bestMatch.role.name,
                quotaMinutes: bestMatch.role.quotaMinutes || 0,
                permissions: {
                    canShift: bestMatch.role.canShift,
                    canViewOtherShifts: bestMatch.role.canViewOtherShifts,
                    canViewLogs: bestMatch.role.canViewLogs,
                    canViewPunishments: bestMatch.role.canViewPunishments,
                    canIssueWarnings: bestMatch.role.canIssueWarnings,
                    canKick: bestMatch.role.canKick,
                    canBan: bestMatch.role.canBan,
                    canBanBolo: bestMatch.role.canBanBolo,
                    canUseToolbox: bestMatch.role.canUseToolbox,
                    canManageBolos: bestMatch.role.canManageBolos,
                    canRequestLoa: bestMatch.role.canRequestLoa,
                    canViewQuota: bestMatch.role.canViewQuota,
                    canUseAdminCommands: bestMatch.role.canUseAdminCommands,
                    canAccessAdmin: bestMatch.role.canAccessAdmin
                }
            })
        }

        // =====================================
        // 4. CHECK FOR EXISTING MEMBER ROLE (fallback for manual assignments)
        // =====================================
        const existingMember = await prisma.member.findFirst({
            where: {
                serverId,
                OR: [
                    { userId: session.user.id },
                    { discordId: discordId }
                ]
            },
            include: { role: true }
        })

        if (existingMember?.role) {
            // User has a manually assigned role - return those permissions
            return NextResponse.json({
                success: true,
                assigned: true,
                roleName: existingMember.role.name,
                quotaMinutes: existingMember.role.quotaMinutes || 0,
                permissions: {
                    canShift: existingMember.role.canShift,
                    canViewOtherShifts: existingMember.role.canViewOtherShifts,
                    canViewLogs: existingMember.role.canViewLogs,
                    canViewPunishments: existingMember.role.canViewPunishments,
                    canIssueWarnings: existingMember.role.canIssueWarnings,
                    canKick: existingMember.role.canKick,
                    canBan: existingMember.role.canBan,
                    canBanBolo: existingMember.role.canBanBolo,
                    canUseToolbox: existingMember.role.canUseToolbox,
                    canManageBolos: existingMember.role.canManageBolos,
                    canRequestLoa: existingMember.role.canRequestLoa,
                    canViewQuota: existingMember.role.canViewQuota,
                    canUseAdminCommands: existingMember.role.canUseAdminCommands,
                    canAccessAdmin: existingMember.role.canAccessAdmin
                }
            })
        }

        // =====================================
        // 5. CHECK FOR STAFF ROLE - VIEWER ACCESS
        // =====================================
        if (server.staffRoleId && userDiscordRoles.includes(server.staffRoleId)) {
            return NextResponse.json({
                success: true,
                assigned: false,
                viewerOnly: true,
                permissions: VIEWER_PERMISSIONS
            })
        }

        // =====================================
        // 6. NO VALID ROLE - BLOCK ACCESS
        // =====================================
        return NextResponse.json({
            noAccess: true,
            message: "You don't have permission to access this panel."
        })

    } catch (e) {
        console.error("Discord role sync error:", e)
        return NextResponse.json({ error: "Failed to sync roles" }, { status: 500 })
    }
}
