"use client"

import { useState } from "react"
import { Plus, Trash2, Loader2, Clock, Shield } from "lucide-react"
import { RoleCombobox } from "./role-combobox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Milestone {
    id: string
    name: string
    requiredMinutes: number
    rewardRoleId: string | null
}

interface MilestonesManagerProps {
    serverId: string
    initialMilestones: Milestone[]
}

export function MilestonesManager({ serverId, initialMilestones }: MilestonesManagerProps) {
    const [milestones, setMilestones] = useState(initialMilestones)
    const [newName, setNewName] = useState("")
    const [newHours, setNewHours] = useState("")
    const [newRoleId, setNewRoleId] = useState("")
    const [loading, setLoading] = useState(false)

    const handleAdd = async () => {
        if (!newName || !newHours) return
        setLoading(true)

        try {
            const res = await fetch("/api/admin/milestones", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    serverId,
                    name: newName,
                    requiredMinutes: Math.floor(parseFloat(newHours) * 60),
                    rewardRoleId: newRoleId || null
                })
            })

            if (res.ok) {
                const milestone = await res.json()
                setMilestones([...milestones, milestone].sort((a, b) => a.requiredMinutes - b.requiredMinutes))
                setNewName("")
                setNewHours("")
                setNewRoleId("")
            }
        } catch (e) {
            console.error("Failed to add milestone", e)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this milestone?")) return

        try {
            const res = await fetch(`/api/admin/milestones?serverId=${serverId}&id=${id}`, {
                method: "DELETE"
            })

            if (res.ok) {
                setMilestones(milestones.filter(m => m.id !== id))
            }
        } catch (e) {
            console.error("Failed to delete milestone", e)
        }
    }

    return (
        <div className="space-y-8">
            {/* Add New Form */}
            <div className="bg-[#222] border border-[#333] rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Add New Milestone</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-2">
                        <label className="text-xs text-zinc-500 font-medium">Milestone Name</label>
                        <Input
                            placeholder="e.g. Senior Staff"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="bg-[#111] border-[#333]"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-zinc-500 font-medium">Required Shift Hours</label>
                        <Input
                            type="number"
                            placeholder="e.g. 50"
                            value={newHours}
                            onChange={(e) => setNewHours(e.target.value)}
                            className="bg-[#111] border-[#333]"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-zinc-500 font-medium">Reward Discord Role</label>
                        <RoleCombobox
                            serverId={serverId}
                            value={newRoleId}
                            onChange={(val) => setNewRoleId(val || "")}
                            placeholder="Select role..."
                        />
                    </div>
                </div>
                <Button
                    onClick={handleAdd}
                    disabled={loading || !newName || !newHours}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Create Milestone
                </Button>
            </div>

            {/* List */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Configured Milestones</h3>
                {milestones.length === 0 ? (
                    <div className="text-center py-12 bg-[#1a1a1a] rounded-xl border border-[#222] border-dashed">
                        <Clock className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                        <p className="text-zinc-500 text-sm">No milestones configured yet.</p>
                    </div>
                ) : (
                    milestones.map((m) => (
                        <div key={m.id} className="flex items-center justify-between p-4 bg-[#222] border border-[#333] rounded-xl hover:border-[#444] transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                    <TrophyIcon className="h-5 w-5 text-emerald-500" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white">{m.name}</h4>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <span className="flex items-center gap-1 text-xs text-zinc-500">
                                            <Clock className="h-3 w-3" />
                                            {(m.requiredMinutes / 60).toFixed(1)} hours required
                                        </span>
                                        {m.rewardRoleId && (
                                            <span className="flex items-center gap-1 text-xs text-indigo-400">
                                                <Shield className="h-3 w-3" />
                                                Reward: {m.rewardRoleId}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(m.id)}
                                className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
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

function TrophyIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
    )
}
