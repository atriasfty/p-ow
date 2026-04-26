import { getSession } from "@/lib/auth-clerk"
import { redirect } from "next/navigation"
import { getServerSettings, PLAN_RETENTION_DEFAULTS } from "@/lib/server-settings"
import { getServerPlan } from "@/lib/subscription"
import { BehaviorSettingsForm } from "./behavior-settings-form"

export default async function BehaviorPage({ params }: { params: Promise<{ serverId: string }> }) {
    const session = await getSession()
    if (!session) redirect("/login")

    const { serverId } = await params

    const [settings, planInfo] = await Promise.all([
        getServerSettings(serverId),
        getServerPlan(serverId)
    ])

    const planRetentionCeiling = PLAN_RETENTION_DEFAULTS[planInfo.plan]

    return (
        <div>
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-white">Behavior Settings</h2>
                <p className="text-zinc-400 mt-1">
                    Configure how Project Overwatch behaves for your community — shift rules, quota periods, in-game commands, and more.
                </p>
            </div>
            <BehaviorSettingsForm
                serverId={serverId}
                initialSettings={settings}
                plan={planInfo.plan}
                planRetentionCeiling={planRetentionCeiling}
            />
        </div>
    )
}
