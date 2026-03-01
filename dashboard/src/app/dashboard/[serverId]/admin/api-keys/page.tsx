import { getSession } from "@/lib/auth-clerk"
import { redirect } from "next/navigation"
import { isServerAdmin } from "@/lib/admin"
import { ApiKeysPanel } from "@/components/admin/api-keys-panel"

export default async function AdminApiKeysPage({
    params,
}: {
    params: Promise<{ serverId: string }>
}) {
    const session = await getSession()
    if (!session) redirect("/login")

    const { serverId } = await params

    if (!await isServerAdmin(session.user as any, serverId)) {
        redirect(`/dashboard/${serverId}/mod-panel`)
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="bg-[#1a1a1a] rounded-xl border border-[#222] p-6">
                <h1 className="text-2xl font-bold text-white mb-2">API Keys</h1>
                <p className="text-zinc-400 text-sm mb-6">Generate and manage API keys for external integrations.</p>
                <ApiKeysPanel serverId={serverId} />
            </div>
        </div>
    )
}
