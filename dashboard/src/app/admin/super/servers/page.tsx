import { prisma } from "@/lib/db"
import { SuperServersTable } from "@/components/admin/super-servers-table"

export default async function SuperServersPage() {
    // Fetch all servers with their owner info (the member who created it - usually the one with isAdmin)
    // For simplicity we just fetch all members who are admins, or just the first one.
    const servers = await prisma.server.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            customName: true,
            apiUrl: true,
            discordGuildId: true,
            subscriberUserId: true,
            subscriptionPlan: true,
            createdAt: true,
            _count: {
                select: { members: true, logs: true }
            }
        }
    })

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-white mb-2">Server Management</h1>
            <p className="text-zinc-400 mb-8">View and control all deployed servers across the platform. Manage subscription tiers manually.</p>

            <div className="rounded-2xl border border-white/5 bg-[#151515] overflow-hidden">
                <SuperServersTable initialServers={servers} />
            </div>
        </div>
    )
}
