"use client"

import { useState, useEffect } from "react"
import { ShieldAlert, Plus, Trash2, Key, Activity, Copy, Check, AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ApiKeysPanel({ serverId }: { serverId: string }) {
    const [keys, setKeys] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [newName, setNewName] = useState("")
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [analytics, setAnalytics] = useState<{ date: string, count: number }[]>([])

    // One-time display state
    const [createdKey, setCreatedKey] = useState<any | null>(null)

    useEffect(() => {
        fetchKeys()
    }, [serverId])

    const fetchKeys = async () => {
        try {
            const res = await fetch(`/api/admin/api-keys?serverId=${serverId}&includeAnalytics=true`)
            if (res.ok) {
                const data = await res.json()
                setKeys(data.keys || data)
                if (data.analytics) setAnalytics(data.analytics)
            }
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newName.trim()) return

        const res = await fetch("/api/admin/api-keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newName, serverId })
        })

        if (res.ok) {
            const data = await res.json()
            setNewName("")
            setIsCreating(false)
            setCreatedKey(data) // Store the full key for one-time display
            fetchKeys()
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) return

        const res = await fetch(`/api/admin/api-keys?id=${id}&serverId=${serverId}`, {
            method: "DELETE"
        })

        if (res.ok) {
            fetchKeys()
        }
    }

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    if (loading) return <div className="text-zinc-400 p-6">Loading API Keys...</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-white">Public API Keys</h2>
                    <p className="text-sm text-zinc-400">Manage API keys for accessing public endpoints programmatically.</p>
                    <a
                        href="https://pow.ciankelly.xyz/api/docs"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline transition-all"
                    >
                        View Developer Documentation ↗
                    </a>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Generate Key
                </button>
            </div>

            {/* Usage Analytics Graph */}
            {analytics.length > 0 && keys.length > 0 && (
                <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 mb-6">
                    <h3 className="text-sm font-medium text-white mb-6 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-indigo-400" />
                        7-Day API Request Volume
                    </h3>
                    <div className="h-40 flex items-end gap-2 sm:gap-4 relative mt-4">
                        {/* Y-axis labels */}
                        <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-[10px] text-zinc-500 font-mono text-right pr-2 select-none">
                            <span>{Math.max(...analytics.map(a => a.count), 10)}</span>
                            <span>{Math.floor(Math.max(...analytics.map(a => a.count), 10) / 2)}</span>
                            <span>0</span>
                        </div>

                        {/* Chart Area */}
                        <div className="flex-1 ml-8 flex items-end justify-between h-full border-b border-white/10 pb-6 relative">
                            {/* Horizontal grid lines */}
                            <div className="absolute inset-x-0 top-0 border-t border-white/5 border-dashed" />
                            <div className="absolute inset-x-0 top-1/2 border-t border-white/5 border-dashed" />

                            {analytics.map((day, i) => {
                                const maxCount = Math.max(...analytics.map(a => a.count), 10)
                                const heightPercent = Math.max((day.count / maxCount) * 100, 1)
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end z-10">
                                        {/* Tooltip */}
                                        <div className="absolute -top-8 bg-zinc-800 border border-white/10 text-white text-[10px] font-bold px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">
                                            {day.count.toLocaleString()} reqs
                                        </div>

                                        {/* Bar */}
                                        <div
                                            className="w-4 sm:w-8 bg-indigo-500/80 hover:bg-indigo-400 transition-all rounded-t decoration-clone border-t border-indigo-300/30"
                                            style={{ height: `${heightPercent}%` }}
                                        />

                                        {/* X-axis label */}
                                        <div className="absolute -bottom-6 text-[10px] text-zinc-500 font-mono">
                                            {day.date}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* One-Time Key Display Modal */}
            {createdKey && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl max-w-lg w-full p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 text-emerald-400 mb-4">
                            <Key className="h-6 w-6" />
                            <h3 className="text-xl font-bold">API Key Generated</h3>
                        </div>

                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3 mb-6">
                            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-200/80">
                                <strong>Important:</strong> Copy this key now. For security, it will <strong>never be shown again</strong> once you close this window.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">
                                    {createdKey.name}
                                </label>
                                <div className="flex items-center gap-2 bg-black border border-zinc-800 rounded-xl p-4 group">
                                    <code className="text-emerald-400 font-mono text-sm break-all flex-1">
                                        {createdKey.key}
                                    </code>
                                    <button
                                        onClick={() => handleCopy(createdKey.key, "new")}
                                        className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white"
                                    >
                                        {copiedId === "new" ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            <Button
                                onClick={() => setCreatedKey(null)}
                                className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
                            >
                                I have saved this key
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {isCreating && (
                <form onSubmit={handleCreate} className="rounded-xl border border-white/10 bg-zinc-900 p-4">
                    <h3 className="mb-4 font-medium text-white">Create New API Key</h3>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="e.g., Discord Bot Integration"
                            className="flex-1 rounded-lg border border-white/10 bg-zinc-950 px-4 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 transition-colors"
                        >
                            Create
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsCreating(false)}
                            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            <div className="space-y-4">
                {keys.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-8 text-center">
                        <Key className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
                        <p className="text-zinc-400">No API keys generated yet.</p>
                    </div>
                ) : (
                    keys.map((key) => (
                        <div key={key.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900 p-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-medium text-white">{key.name}</h3>
                                    {key.enabled ? (
                                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">Active</span>
                                    ) : (
                                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">Disabled</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-zinc-500 w-full sm:w-auto mt-3 sm:mt-0">
                                    <div className="flex-1 sm:flex-none">
                                        <div className="flex items-center justify-between gap-3 mb-1.5">
                                            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                                                <Activity className="h-3 w-3 text-indigo-400" />
                                                Daily Usage
                                            </div>
                                            <span className="tabular-nums text-white">
                                                {key.usageCount.toLocaleString()} / {key.dailyLimit === Infinity || key.dailyLimit > 100000 ? "Unlimited" : key.dailyLimit.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full sm:w-48 bg-black border border-white/10 rounded-full overflow-hidden shrink-0">
                                            <div
                                                className="h-full bg-indigo-500 transition-all duration-1000"
                                                style={{ width: `${key.dailyLimit === Infinity || key.dailyLimit > 100000 ? 100 : Math.min((key.usageCount / key.dailyLimit) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="h-6 w-px bg-white/10 hidden sm:block mx-1" />
                                    <div className="flex items-center gap-2 bg-black/50 border border-white/5 py-1.5 px-3 rounded-lg font-mono">
                                        {key.key}
                                        <button
                                            onClick={() => handleCopy(key.key, key.id)}
                                            className="ml-1 text-zinc-500 hover:text-white transition-colors"
                                            title="Copy masked key"
                                        >
                                            {copiedId === key.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(key.id)}
                                className="rounded-lg p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                title="Revoke Key"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
