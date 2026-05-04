"use client"

import { useState, useEffect } from "react"
import { Key, Trash2, ShieldCheck, Plus, Check, Copy, Gauge, Calendar } from "lucide-react"
import { ConfirmModal } from "@/components/ui/confirm-modal"

interface ApiKey {
    id: string
    name: string
    key: string
    enabled: boolean
    createdAt: string
    lastUsed: string | null
    rateLimit: number
    dailyLimit: number
    usageCount: number
}

interface ApiKeysManagerProps {
    isSuperAdmin: boolean
}

export function ApiKeysManager({ isSuperAdmin }: ApiKeysManagerProps) {
    const [keys, setKeys] = useState<ApiKey[]>([])
    const [loading, setLoading] = useState(true)
    const [newName, setNewName] = useState("")
    const [isCreating, setIsCreating] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [confirmId, setConfirmId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        if (isSuperAdmin) fetchKeys()
    }, [isSuperAdmin])

    const fetchKeys = async () => {
        try {
            const res = await fetch("/api/admin/api-keys")
            if (res.ok) setKeys(await res.json())
        } catch (e) {
            console.error("Failed to fetch keys", e)
        } finally {
            setLoading(false)
        }
    }

    const createKey = async () => {
        if (!newName) return
        setIsCreating(true)
        try {
            const res = await fetch("/api/admin/api-keys", {
                method: "POST",
                headers: { "x-csrf-check": "1", "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName })
            })
            if (res.ok) {
                setNewName("")
                fetchKeys()
            }
        } catch (e) {
            console.error("Failed to create key", e)
        } finally {
            setIsCreating(false)
        }
    }

    const deleteKey = async (id: string) => {
        setConfirmId(id)
    }

    const confirmDelete = async () => {
        if (!confirmId) return
        const id = confirmId
        setIsDeleting(true)
        try {
            await fetch(`/api/admin/api-keys?id=${id}`, { method: "DELETE", headers: { "x-csrf-check": "1" } })
            fetchKeys()
            setConfirmId(null)
        } catch (e) {
            console.error("Failed to delete key", e)
        } finally {
            setIsDeleting(false)
        }
    }

    const updateKey = async (id: string, updates: Partial<ApiKey>) => {
        try {
            await fetch("/api/admin/api-keys", {
                method: "PATCH",
                headers: { "x-csrf-check": "1", "Content-Type": "application/json" },
                body: JSON.stringify({ id, ...updates })
            })
            fetchKeys()
        } catch (e) {
            console.error("Failed to update key", e)
        }
    }

    const copyToClipboard = (id: string, key: string) => {
        navigator.clipboard.writeText(key)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    if (!isSuperAdmin) return null

    return (
        <div className="mx-auto mt-12 max-w-5xl rounded-xl border border-white/5 bg-zinc-900/50 p-8">
            <div className="mb-6 flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-medium text-white">Global API Keys</h2>
                        <p className="text-xs text-zinc-500">Superadmin Only • Manage internal tool access & rate limits</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {/* Create Key */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Key Name (e.g. Discord Bot)"
                        className="block w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                        onClick={createKey}
                        disabled={isCreating || !newName}
                        className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
                    >
                        <Plus className="h-4 w-4" />
                        Generate
                    </button>
                </div>

                {/* Keys List */}
                <div className="overflow-hidden rounded-lg border border-white/5 bg-zinc-950">
                    <table className="min-w-full divide-y divide-white/5">
                        <thead className="bg-[#111]">
                            <tr>
                                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500">Name</th>
                                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500">Key</th>
                                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500">Rate Limits</th>
                                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500">Usage</th>
                                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-zinc-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {keys.map((k) => (
                                <tr key={k.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-white">
                                        {k.name}
                                        <div className="text-[10px] text-zinc-500 mt-0.5">
                                            {k.lastUsed ? `Last: ${new Date(k.lastUsed).toLocaleString()}` : 'Never used'}
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-400">
                                        <div className="flex items-center gap-2">
                                            <code className="bg-zinc-900 px-2 py-0.5 rounded text-xs font-mono">pow_••••••••</code>
                                            <button
                                                onClick={() => copyToClipboard(k.id, k.key)}
                                                className="text-zinc-500 hover:text-white transition-colors"
                                            >
                                                {copiedId === k.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                <Gauge className="h-3 w-3 text-indigo-400" />
                                                <input
                                                    type="number"
                                                    value={k.rateLimit}
                                                    onChange={(e) => updateKey(k.id, { rateLimit: parseInt(e.target.value) || 1 })}
                                                    className="w-12 bg-transparent border-b border-white/5 focus:border-indigo-500 outline-none text-white text-center"
                                                />
                                                <span>s wait</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                <Calendar className="h-3 w-3 text-indigo-400" />
                                                <input
                                                    type="number"
                                                    value={k.dailyLimit}
                                                    onChange={(e) => updateKey(k.id, { dailyLimit: parseInt(e.target.value) || 1 })}
                                                    className="w-12 bg-transparent border-b border-white/5 focus:border-indigo-500 outline-none text-white text-center"
                                                />
                                                <span>/ day</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">Daily Usage</span>
                                                <span className="text-xs text-white tabular-nums">{k.usageCount} / {k.dailyLimit}</span>
                                            </div>
                                            <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500 transition-all duration-500"
                                                    style={{ width: `${Math.min((k.usageCount / k.dailyLimit) * 100, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                                        <div className="flex items-center justify-end gap-3">
                                            <button
                                                onClick={() => updateKey(k.id, { enabled: !k.enabled })}
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter transition-colors ${k.enabled ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}
                                            >
                                                {k.enabled ? 'Active' : 'Disabled'}
                                            </button>
                                            <button
                                                onClick={() => deleteKey(k.id)}
                                                className="text-zinc-600 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {keys.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-xs text-zinc-500 italic">No API keys generated yet</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmModal
                isOpen={!!confirmId}
                onClose={() => setConfirmId(null)}
                onConfirm={confirmDelete}
                title="Delete API Key"
                description="Are you sure you want to delete this API key? Any internal tools or scripts currently using this key will immediately lose access to the platform."
                confirmLabel="Revoke Key"
                isLoading={isDeleting}
            />
        </div>
    )
}
