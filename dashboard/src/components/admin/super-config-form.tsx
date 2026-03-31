"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Save, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useDialog } from "@/components/providers/dialog-provider"

export function SuperConfigForm() {
    const router = useRouter()
    const [key, setKey] = useState("")
    const [value, setValue] = useState("")
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const { showConfirm } = useDialog()

    const SUGGESTED_KEYS = [
        "MAX_REQUESTS_PER_MINUTE",
        "BAN_REASON",
        "SYNC_INTERVAL_MS",
        "ROLE_SYNC_INTERVAL_MS",
        "QUEUE_INTERVAL_MS",
        "PRC_BASE_URL",
        "ROBLOX_OPEN_CLOUD_BASE",
        "MAINTENANCE_MODE"
    ]

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!key || !value) return

        setLoading(true)
        setMessage(null)

        try {
            const res = await fetch("/api/admin/super/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, value })
            })

            const data = await res.json()
            if (res.ok) {
                setMessage({ type: 'success', text: "Configuration saved successfully." })
                setKey("")
                setValue("")
                router.refresh()
            } else {
                setMessage({ type: 'error', text: data.error || "Failed to save configuration." })
            }
        } catch (error) {
            setMessage({ type: 'error', text: "An error occurred." })
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!key) return
        const confirmed = await showConfirm("Delete Config", `Are you sure you want to delete the config key: ${key}?`, "Delete", "destructive")
        if (!confirmed) return

        setLoading(true)
        try {
            const res = await fetch(`/api/admin/super/config?key=${encodeURIComponent(key)}`, {
                method: "DELETE"
            })
            if (res.ok) {
                setMessage({ type: 'success', text: "Configuration deleted successfully." })
                setKey("")
                setValue("")
                router.refresh()
            } else {
                setMessage({ type: 'error', text: "Failed to delete configuration." })
            }
        } catch (error) {
            setMessage({ type: 'error', text: "An error occurred." })
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSave} className="space-y-4">
            {message && (
                <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {message.text}
                </div>
            )}

            <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Config Key</label>
                <div className="flex flex-wrap gap-2 mb-2">
                    {SUGGESTED_KEYS.map(k => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => setKey(k)}
                            className={`text-[10px] px-2 py-1 rounded border transition-colors ${key === k ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600'}`}
                        >
                            {k}
                        </button>
                    ))}
                </div>
                <Input
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="e.g. MAINTENANCE_MODE"
                    className="bg-zinc-900 border-zinc-800 focus-visible:ring-zinc-700 font-mono text-sm"
                    disabled={loading}
                />
            </div>

            <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Config Value</label>
                <Textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Value (can be JSON if needed)"
                    className="bg-zinc-900 border-zinc-800 focus-visible:ring-zinc-700 min-h-[120px] font-mono text-sm"
                    disabled={loading}
                />
            </div>

            <div className="pt-2 flex gap-3">
                <Button
                    type="submit"
                    disabled={loading || !key || !value}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Configuration
                </Button>

                <Button
                    type="button"
                    variant="destructive"
                    disabled={loading || !key}
                    onClick={handleDelete}
                    className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </form>
    )
}
