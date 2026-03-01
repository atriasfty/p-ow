import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { Trophy } from "lucide-react"
import { MilestonesManager } from "@/components/admin/milestones-manager"

export default async function AdminMilestonesPage({ params }: { params: Promise<{ serverId: string }> }) {
    const session = await getSession()
    if (!session) redirect("/login")

    const { serverId } = await params

    const milestones = await prisma.staffMilestone.findMany({
        where: { serverId },
        orderBy: { requiredMinutes: "asc" }
    })

    return (
        <div className="space-y-8">
            <div className="bg-[#1a1a1a] rounded-xl border border-[#222] overflow-hidden">
                <div className="p-6 border-b border-[#222]">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Trophy className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="font-bold text-white">Staff Milestones</h2>
                            <p className="text-xs text-zinc-500">Automatically reward staff for their time on duty</p>
                        </div>
                    </div>
                </div>
                <div className="p-6">
                    <MilestonesManager serverId={serverId} initialMilestones={milestones} />
                </div>
            </div>
        </div>
    )
}
