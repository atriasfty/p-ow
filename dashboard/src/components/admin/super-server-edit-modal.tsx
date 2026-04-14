"use client"

import { useState } from "react"
import { Loader2, X, Save } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useDialog } from "@/components/providers/dialog-provider"

interface SuperServerEditModalProps {
    server: any
    isOpen: boolean
    onClose: () => void
    onUpdate: (updatedServer: any) => void
}

export function SuperServerEditModal({ server, isOpen, onClose, onUpdate }: SuperServerEditModalProps) {
    const [formData, setFormData] = useState({
        customName: server.customName || "",
        apiUrl: server.apiUrl || "",
        discordGuildId: server.discordGuildId || "",
        subscriberUserId: server.subscriberUserId || "",
        subscriptionPlan: server.subscriptionPlan || "free"
    })
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const { showAlert } = useDialog()

    if (!isOpen) return null

    const handleSave = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/super/servers/${server.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            })

            if (res.ok) {
                const data = await res.json()
                onUpdate(data.server)
                onClose()
                router.refresh()
            } else {
                await showAlert("Error", "Failed to update server.", "error")
            }
        } catch (e) {
            await showAlert("Error", "An error occurred.", "error")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-xl bg-[#151515] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#111]">
                    <div>
                        <h2 className="text-xl font-bold text-white">Edit Server</h2>
                        <p className="text-xs text-zinc-500 font-mono mt-1">{server.id}</p>
                    </div>
                    <button onClick={onClose} aria-label="Close edit modal" className="p-2 hover:bg-white/5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400">
                        <X className="h-5 w-5 text-zinc-500" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Custom Display Name</label>
                        <Input
                            value={formData.customName}
                            onChange={(e) => setFormData({ ...formData, customName: e.target.value })}
                            className="bg-zinc-900 border-zinc-800 focus-visible:ring-zinc-700"
                            placeholder="e.g. My Community Backend"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">PRC API Key (apiUrl)</label>
                        <Input
                            value={formData.apiUrl}
                            onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                            className="bg-zinc-900 border-zinc-800 focus-visible:ring-zinc-700 font-mono text-sm"
                            placeholder="Paste PRC Key here"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Discord Guild ID</label>
                            <Input
                                value={formData.discordGuildId}
                                onChange={(e) => setFormData({ ...formData, discordGuildId: e.target.value })}
                                className="bg-zinc-900 border-zinc-800 focus-visible:ring-zinc-700 font-mono text-sm"
                                placeholder="123456789..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Subscription Plan</label>
                            <select
                                className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-lg h-10 px-3 text-sm focus:ring-zinc-700 focus:border-zinc-700 outline-none appearance-none"
                                value={formData.subscriptionPlan}
                                onChange={(e) => setFormData({ ...formData, subscriptionPlan: e.target.value })}
                            >
                                <option value="free">Free</option>
                                <option value="pow-pro">POW Pro</option>
                                <option value="pow-max">POW Max</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Owner (Subscriber User ID)</label>
                        <Input
                            value={formData.subscriberUserId}
                            onChange={(e) => setFormData({ ...formData, subscriberUserId: e.target.value })}
                            className="bg-zinc-900 border-zinc-800 focus-visible:ring-zinc-700 font-mono text-xs"
                            placeholder="user_..."
                        />
                        <p className="text-[10px] text-zinc-600 italic">This user is considered the owner for billing and management purposes.</p>
                    </div>
                </div>

                <div className="p-6 border-t border-white/5 bg-[#111] flex gap-3">
                    <Button
                        variant="outline"
                        className="flex-1 border-zinc-800 hover:bg-zinc-800 text-zinc-400"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                        onClick={handleSave}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Save Changes</>}
                    </Button>
                </div>
            </div>
        </div>
    )
}
