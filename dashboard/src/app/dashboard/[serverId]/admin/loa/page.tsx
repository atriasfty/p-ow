
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { redirect } from "next/navigation"
import { Calendar, Check, X, Clock } from "lucide-react"
import { LoaList } from "./loa-list"
import { clerkClient } from "@clerk/nextjs/server"

export default async function AdminLoaPage({ params }: { params: Promise<{ serverId: string }> }) {
    const session = await getSession()
    if (!session) redirect("/login")

    const { serverId } = await params

    const hasAccess = await isServerAdmin(session.user, serverId)
    if (!hasAccess) redirect(`/dashboard/${serverId}/mod-panel`)

    // Get all LOAs for this server
    const loas = await prisma.leaveOfAbsence.findMany({
        where: { serverId },
        orderBy: [
            { status: "asc" }, // pending first
            { createdAt: "desc" }
        ],
        include: {
            server: {
                select: { customName: true, name: true }
            }
        }
    })

    // Fetch user details from Clerk for all unique user IDs
    const uniqueUserIds = Array.from(new Set(loas.map((l: any) => l.userId)))
    let clerkUsers: any[] = []


    if (uniqueUserIds.length > 0) {
        try {
            const client = await clerkClient()
            const userPromises = []

            for (let i = 0; i < uniqueUserIds.length; i += 100) {
                const chunk = uniqueUserIds.slice(i, i + 100) as string[]
                userPromises.push(client.users.getUserList({ userId: chunk, limit: 100 }))
            }

            const userResponses = await Promise.all(userPromises)
            const clerkUsersRaw = userResponses.flatMap(res => res.data)
            
            clerkUsers = clerkUsersRaw.map(user => {

                const discordAccount = user.externalAccounts.find(
                    a => (a.provider as string) === "discord" || (a.provider as string) === "oauth_discord"
                )
                const robloxAccount = user.externalAccounts.find(
                    a => ["roblox", "oauth_roblox", "oauth_custom_roblox", "custom_roblox"].includes(a.provider as string)
                )

                return {
                    id: user.id,
                    username: user.username,
                    name: user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.firstName || user.username,
                    image: user.imageUrl,
                    discordId: discordAccount?.externalId,
                    discordUsername: discordAccount?.username,
                    robloxId: robloxAccount?.externalId,
                    robloxUsername: (robloxAccount as any)?.username || (robloxAccount as any)?.externalNickname
                }
            })
        } catch (e) {
            console.error("Failed to fetch Clerk users for LOA list", e)
        }
    }

    const pending = loas.filter((l: any) => l.status === "pending")
    const active = loas.filter((l: any) => l.status === "approved" && new Date(l.endDate) >= new Date())
    const past = loas.filter((l: any) => l.status !== "pending" && (l.status === "declined" || new Date(l.endDate) < new Date()))

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                    <h2 className="font-bold text-white">Leave of Absences</h2>
                    <p className="text-xs text-zinc-500">{pending.length} pending, {active.length} active</p>
                </div>
            </div>

            <LoaList
                serverId={serverId}
                pending={pending}
                active={active}
                past={past}
                initialUsers={clerkUsers}
            />
        </div>
    )
}
