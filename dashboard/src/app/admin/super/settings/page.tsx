import { prisma } from "@/lib/db"
import { SuperSettingsPanel } from "@/components/admin/super-settings-panel"
import { SuperConfigForm } from "@/components/admin/super-config-form"
import { Shield } from "lucide-react"

export default async function SuperSettingsPage() {
    const configs = await prisma.config.findMany({
        orderBy: { key: 'asc' }
    })

    return (
        <div className="p-8">
            <div className="flex items-center gap-4 mb-2">
                <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                    <Shield className="h-6 w-6 text-indigo-500" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Global Configuration</h1>
                    <p className="text-zinc-400">Manage system-wide backend settings and feature toggles.</p>
                </div>
            </div>

            <div className="mt-8">
                <SuperSettingsPanel initialConfigs={configs} />
            </div>

            {/* Legacy Raw Access - Hidden by default or put in a collapsible if needed */}
            <div className="mt-16 pt-8 border-t border-white/5">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-500"></span>
                    Manual Override
                </h3>
                <div className="grid gap-8 lg:grid-cols-2">
                    <div className="rounded-2xl border border-white/5 bg-[#151515] p-6">
                        <h3 className="text-sm font-bold text-zinc-400 mb-4 uppercase tracking-wider">Add or Edit Raw Config</h3>
                        <SuperConfigForm />
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-[#151515] p-6">
                        <h3 className="text-sm font-bold text-zinc-400 mb-4 uppercase tracking-wider">All Active Keys</h3>
                        <div className="space-y-2">
                            {configs.map(config => (
                                <div key={config.key} className="p-3 rounded-lg border border-white/5 bg-[#111] flex items-center justify-between group hover:border-zinc-700 transition-colors">
                                    <p className="font-mono text-xs text-zinc-400 group-hover:text-emerald-400 transition-colors">{config.key}</p>
                                    <div className="text-[10px] text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5">
                                        v1.0
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
