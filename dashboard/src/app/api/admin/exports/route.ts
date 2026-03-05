import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { isServerFeatureEnabled } from "@/lib/feature-flags"

export async function GET(req: Request) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")
    const type = searchParams.get("type") // 'shifts', 'roles', 'members'

    if (!serverId || !type) {
        return new NextResponse("Missing parameters", { status: 400 })
    }

    // Check permissions
    if (!await isServerAdmin(session.user as any, serverId)) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    // Check Subscription (Requires Pro or Max)
    const canExport = await isServerFeatureEnabled('EXPORTS', serverId)
    if (!canExport) {
        return new NextResponse("Export feature requires a Pro or Max subscription.", { status: 403 })
    }

    try {
        let csvContent = ""

        if (type === "members") {
            const members = await prisma.member.findMany({
                where: { serverId },
                include: { role: true }
            })

            // Get Discord/Roblox usernames from Clerk (excluding emails/PII)
            const clerk = await clerkClient()
            const userIds: string[] = members.map((m: any) => m.userId)
            // Fetch in batches if necessary, but assume small enough for standard Clerk call
            const clerkUsers = await clerk.users.getUserList({ userId: userIds, limit: 100 })
            
            const userMap = new Map(clerkUsers.data.map((u: any) => {
                const robloxAccount = u.externalAccounts.find((a: any) => 
                    a.provider === "roblox" || a.provider.startsWith("oauth_custom_roblox")
                )
                const discordAccount = u.externalAccounts.find((a: any) => a.provider === "oauth_discord")
                
                return [u.id as string, {
                    roblox: robloxAccount?.username || "Unknown",
                    discord: discordAccount?.username || "Unknown"
                }]
            }))

            csvContent = "Roblox Username,Discord Username,Panel Role,Is Admin\n"
            members.forEach((m: any) => {
                const names = userMap.get(m.userId) || { roblox: "Unknown", discord: "Unknown" }
                csvContent += `${names.roblox},${names.discord},${m.role?.name || "None"},${m.isAdmin}\n`
            })
            
        } else if (type === "shifts") {
            const shifts = await prisma.shift.findMany({
                where: { serverId },
                orderBy: { startTime: "desc" },
                take: 500 // Limit to last 500 for performance
            })

            const clerk = await clerkClient()
            const userIds: string[] = Array.from(new Set(shifts.map((s: any) => s.userId)))
            const clerkUsers = await clerk.users.getUserList({ userId: userIds, limit: 100 })
            
            const userMap = new Map(clerkUsers.data.map((u: any) => {
                const robloxAccount = u.externalAccounts.find((a: any) => 
                    a.provider === "roblox" || a.provider.startsWith("oauth_custom_roblox")
                )
                return [u.id as string, robloxAccount?.username || "Unknown"]
            }))

            csvContent = "Roblox Username,Start Time,End Time,Duration (Seconds)\n"
            shifts.forEach((s: any) => {
                const robloxName = userMap.get(s.userId) || "Unknown"
                csvContent += `${robloxName},${s.startTime.toISOString()},${s.endTime ? s.endTime.toISOString() : "Active"},${s.duration || 0}\n`
            })

        } else if (type === "roles") {
            const roles = await prisma.role.findMany({
                where: { serverId },
                include: { _count: { select: { members: true } } }
            })

            csvContent = "Role Name,Discord Role ID,Member Count,Can Ban,Can Use Toolbox\n"
            roles.forEach((r: any) => {
                csvContent += `"${r.name}",${r.discordRoleId || "None"},${r._count.members},${r.canBan},${r.canUseToolbox}\n`
            })

        } else {
            return new NextResponse("Invalid export type", { status: 400 })
        }

        return new NextResponse(csvContent, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="pow_${type}_export.csv"`
            }
        })
    } catch (e) {
        console.error("Export error:", e)
        return new NextResponse("Failed to generate export", { status: 500 })
    }
}
