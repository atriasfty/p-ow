"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Save, Shield, Zap, Globe, Lock, Info, Server, CreditCard, Layout } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface Config {
    key: string
    value: string
}

interface SuperSettingsPanelProps {
    initialConfigs: Config[]
}

export function SuperSettingsPanel({ initialConfigs }: SuperSettingsPanelProps) {
    const router = useRouter()
    const [configs, setConfigs] = useState<Record<string, string>>(
        Object.fromEntries(initialConfigs.map(c => [c.key, c.value]))
    )
    const [loading, setLoading] = useState<string | null>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    const updateConfig = async (key: string, value: string) => {
        setLoading(key)
        setMessage(null)

        try {
            const res = await fetch("/api/admin/super/config", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-csrf-check": "1"
                },
                body: JSON.stringify({ key, value })
            })

            if (res.ok) {
                setConfigs(prev => ({ ...prev, [key]: value }))
                setMessage({ type: 'success', text: `Updated ${key}` })
                router.refresh()
            } else {
                const data = await res.json()
                setMessage({ type: 'error', text: data.error || `Failed to update ${key}` })
            }
        } catch (error) {
            setMessage({ type: 'error', text: "An error occurred." })
        } finally {
            setLoading(null)
        }
    }

    const ToggleSetting = ({ id, label, description, icon: Icon, defaultOn = false }: { id: string, label: string, description: string, icon: any, defaultOn?: boolean }) => {
        const value = configs[id]
        const isEnabled = value === undefined ? defaultOn : value === "true"
        return (
            <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-[#111] hover:bg-[#151515] transition-colors">
                <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${isEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="font-semibold text-white">{label}</p>
                        <p className="text-xs text-zinc-500">{description}</p>
                    </div>
                </div>
                <button
                    onClick={() => updateConfig(id, isEnabled ? "false" : "true")}
                    disabled={loading === id}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#111] ${isEnabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                    role="switch"
                    aria-checked={isEnabled}
                    aria-label={label}
                >
                    {loading === id ? (
                        <Loader2 className="h-3 w-3 animate-spin mx-auto text-white" />
                    ) : (
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    )}
                </button>
            </div>
        )
    }

    const InputSetting = ({ id, label, description, icon: Icon, type = "text", placeholder }: { id: string, label: string, description: string, icon: any, type?: string, placeholder?: string }) => {
        const [localValue, setLocalValue] = useState(configs[id] || "")
        const hasChanged = localValue !== (configs[id] || "")

        return (
            <div className="p-4 rounded-xl border border-white/5 bg-[#111] space-y-3">
                <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-zinc-800 text-zinc-400">
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-white">{label}</p>
                        <p className="text-xs text-zinc-500">{description}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Input
                        type={type}
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        placeholder={placeholder}
                        className="bg-zinc-900 border-zinc-800 focus-visible:ring-zinc-700 font-mono text-sm"
                    />
                    <Button
                        onClick={() => updateConfig(id, localValue)}
                        disabled={loading === id || !hasChanged}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500"
                    >
                        {loading === id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {message && (
                <div className={`p-4 rounded-xl text-sm animate-in fade-in slide-in-from-top-2 duration-300 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    <div className="flex items-center gap-2">
                        {message.type === 'success' ? <Zap className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                        {message.text}
                    </div>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                {/* Feature Toggles */}
                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1 flex items-center gap-2">
                        <Zap className="h-3 w-3" /> Feature Toggles
                    </h3>
                    <div className="space-y-3">
                        <ToggleSetting 
                            id="SERVER_CREATION"
                            label="Server Creation"
                            description="Allow users to deploy new POW servers."
                            icon={Server}
                            defaultOn={true}
                        />
                        <ToggleSetting 
                            id="SUBSCRIPTIONS_ENABLED"
                            label="Subscriptions"
                            description="Enable Stripe billing and plan gating."
                            icon={CreditCard}
                            defaultOn={true}
                        />
                        <ToggleSetting 
                            id="PRICING_PAGE"
                            label="Pricing Page"
                            description="Make the public pricing page visible."
                            icon={Layout}
                            defaultOn={true}
                        />
                        <ToggleSetting 
                            id="MAINTENANCE_MODE"
                            label="Maintenance Mode"
                            description="Block access to the dashboard for maintenance."
                            icon={Lock}
                        />
                    </div>
                </div>

                {/* API & System Settings */}
                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1 flex items-center gap-2">
                        <Globe className="h-3 w-3" /> System Config
                    </h3>
                    <div className="space-y-3">
                        <InputSetting 
                            id="PRC_BASE_URL"
                            label="PRC API Base"
                            description="Primary endpoint for Police Roleplay Community."
                            icon={Globe}
                            placeholder="https://api.policeroleplay.community/v1"
                        />
                        <InputSetting 
                            id="MAX_REQUESTS_PER_MINUTE"
                            label="Rate Limit"
                            description="Global max requests per minute per IP."
                            icon={Shield}
                            type="number"
                            placeholder="200"
                        />
                        <InputSetting 
                            id="SYNC_INTERVAL_MS"
                            label="Log Sync Interval"
                            description="Frequency of polling PRC logs (ms)."
                            icon={Shield}
                            type="number"
                            placeholder="10000"
                        />
                    </div>
                </div>
            </div>

            {/* Advanced / Other */}
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1 flex items-center gap-2">
                    <Shield className="h-3 w-3" /> Advanced Configurations
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {/* Raw Key/Value fallback for keys not in UI yet */}
                    {Object.entries(configs)
                        .filter(([k]) => !["SERVER_CREATION", "SUBSCRIPTIONS_ENABLED", "PRICING_PAGE", "MAINTENANCE_MODE", "PRC_BASE_URL", "MAX_REQUESTS_PER_MINUTE", "SYNC_INTERVAL_MS"].includes(k))
                        .map(([k, v]) => (
                            <div key={k} className="p-4 rounded-xl border border-white/5 bg-[#111] space-y-2">
                                <p className="font-mono text-xs text-emerald-400 font-semibold">{k}</p>
                                <Textarea 
                                    value={v} 
                                    readOnly 
                                    className="h-20 bg-zinc-900/50 border-zinc-800 text-[10px] font-mono text-zinc-400"
                                />
                            </div>
                        ))
                    }
                </div>
            </div>
        </div>
    )
}
