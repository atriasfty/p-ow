import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { isServerAdmin } from "@/lib/admin"
import Link from "next/link"
import { FormAutomationSettings } from "@/components/forms/form-automation-settings"

export default async function FormSettingsPage({
    params,
}: {
    params: Promise<{ serverId: string }>
}) {
    const session = await getSession()
    if (!session) redirect("/login")

    const { serverId } = await params
    const isAdmin = await isServerAdmin(session.user, serverId)

    if (!isAdmin) {
        redirect(`/dashboard/${serverId}/forms`)
    }

    const server = await prisma.server.findUnique({
        where: { id: serverId },
        select: {
            id: true,
            name: true,
            customName: true,
            loaChannelId: true,
            onLoaRoleId: true,
        }
    })

    if (!server) redirect("/dashboard")

    return (
        <div className="min-h-screen bg-[#111] flex flex-col">
            <div className="w-full px-6 py-4 flex items-center gap-2">
                <img src="/logo.png" alt="POW" className="h-8 w-8 opacity-70" />
                <span className="text-white/70 text-sm font-medium">Project Overwatch</span>
            </div>

            <div className="max-w-4xl mx-auto px-6 pb-12 space-y-6 w-full">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Form Automation Settings</h1>
                        <p className="text-zinc-400 mt-1">
                            Configure how forms interact with your Discord server.
                        </p>
                    </div>
                    <Link
                        href={`/dashboard/${serverId}/forms`}
                        className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                    >
                        Back to Forms
                    </Link>
                </div>

                <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-8">
                    <FormAutomationSettings 
                        serverId={serverId}
                        initialData={{
                            loaChannelId: server.loaChannelId || "",
                            onLoaRoleId: server.onLoaRoleId || "",
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
