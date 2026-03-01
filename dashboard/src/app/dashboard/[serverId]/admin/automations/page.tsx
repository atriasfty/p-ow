"use client"

import { useState, useEffect, use } from "react"
import { Plus, Zap, Trash2, Edit2, Loader2 } from "lucide-react"
import { AutomationEditor } from "./automation-editor"
import { LimitIndicator, SubscriptionPromo } from "@/components/subscription/subscription-ui"

interface Automation {
    id: string
    name: string
    trigger: string
    enabled: boolean
    conditions: any
    actions: any
}

export default function AutomationsPage({ params: paramsPromise }: { params: Promise<{ serverId: string }> }) {
    const params = use(paramsPromise)
    const [automations, setAutomations] = useState<Automation[]>([])
    const [loading, setLoading] = useState(true)
    const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [limits, setLimits] = useState({ allowed: true, current: 0, max: 0 })

    useEffect(() => {
        fetchAutomations()
        fetchLimits()
    }, [params.serverId])

    const fetchAutomations = async () => {
        try {
            const res = await fetch(`/api/admin/automations?serverId=${params.serverId}`)
            if (res.ok) {
                const data = await res.json()
                setAutomations(data)
            }
        } catch (e) {
            console.error("Failed to load automations", e)
        } finally {
            setLoading(false)
        }
    }

    const fetchLimits = async () => {
        try {
            const res = await fetch(`/api/server/${params.serverId}/plan`)
            if (res.ok) {
                const planInfo = await res.json()
                // Assuming we have a dedicated endpoint for current usage, or we just calculate here
                // For simplicity, we use the automations array length for current
                setLimits({
                    allowed: automations.length < planInfo.automations,
                    current: automations.length, // This is technically a race condition but ok for UI
                    max: planInfo.automations
                })
            }
        } catch (e) { }
    }
    
    useEffect(() => {
        if(limits.max > 0) {
            setLimits(prev => ({ ...prev, allowed: automations.length < prev.max, current: automations.length }))
        }
    }, [automations])

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this automation?")) return

        try {
            const res = await fetch("/api/admin/automations", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serverId: params.serverId, id })
            })

            if (res.ok) {
                setAutomations(prev => prev.filter(a => a.id !== id))
            }
        } catch (e) { }
    }

    const handleSave = (automation: Automation) => {
        if (isCreating) {
            setAutomations(prev => [automation, ...prev])
            setIsCreating(false)
        } else {
            setAutomations(prev => prev.map(a => a.id === automation.id ? automation : a))
            setEditingAutomation(null)
        }
    }

    if (loading) return <div className="p-8 text-center text-zinc-500"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>

    if (isCreating || editingAutomation) {
        return (
            <AutomationEditor
                serverId={params.serverId}
                automation={editingAutomation || undefined}
                onSave={handleSave}
                onClose={() => {
                    setIsCreating(false)
                    setEditingAutomation(null)
                }}
            />
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Automations</h1>
                    <p className="text-zinc-400 text-sm">Automate server moderation and operations.</p>
                </div>
                <div className="flex items-center gap-4">
                    <LimitIndicator current={limits.current} max={limits.max} label="Automations Usage" />
                    <button
                        onClick={() => setIsCreating(true)}
                        disabled={!limits.allowed}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            limits.allowed 
                            ? "bg-emerald-500 text-black hover:bg-emerald-400" 
                            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                        }`}
                    >
                        <Plus className="h-4 w-4" />
                        Create Automation
                    </button>
                </div>
            </div>

            {!limits.allowed && (
                <SubscriptionPromo 
                    title="Automation Limit Reached"
                    description="You have reached the maximum number of active automations for your current plan. Upgrade your server to unlock more powerful workflows."
                />
            )}

            <div className="grid gap-4">
                {automations.length === 0 ? (
                    <div className="text-center py-12 bg-zinc-900/50 rounded-xl border border-white/10">
                        <Zap className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white mb-2">No Automations</h3>
                        <p className="text-zinc-400 mb-6">Create automations to handle repetitive tasks automatically.</p>
                        {limits.allowed && (
                            <button
                                onClick={() => setIsCreating(true)}
                                className="inline-flex items-center gap-2 bg-emerald-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-emerald-400"
                            >
                                <Plus className="h-4 w-4" /> Create One Now
                            </button>
                        )}
                    </div>
                ) : (
                    automations.map(automation => {
                        let parsedTrigger = automation.trigger
                        if (parsedTrigger === "PLAYER_JOIN") parsedTrigger = "Player Joined"
                        if (parsedTrigger === "PLAYER_LEAVE") parsedTrigger = "Player Left"

                        return (
                            <div key={automation.id} className="bg-zinc-900 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${automation.enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                                        <Zap className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">{automation.name}</h3>
                                        <p className="text-sm text-zinc-400">Trigger: {parsedTrigger}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 text-xs rounded font-medium ${automation.enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                                        {automation.enabled ? "Active" : "Disabled"}
                                    </span>
                                    <button
                                        onClick={() => setEditingAutomation(automation)}
                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-zinc-400"
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(automation.id)}
                                        className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors text-zinc-400"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}