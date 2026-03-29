"use client"

import { useState } from "react"
import { Search, Loader2, Edit2, Trash2, Shield, ExternalLink, Calendar, Key, User } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { SuperServerEditModal } from "./super-server-edit-modal"
import { ConfirmModal } from "@/components/ui/confirm-modal"

export function SuperServersTable({ initialServers }: { initialServers: any[] }) {
    const [servers, setServers] = useState(initialServers)
    const [search, setSearch] = useState("")
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [editingServer, setEditingServer] = useState<any | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const router = useRouter()

    const filteredServers = servers.filter(s =>
        (s.customName || "").toLowerCase().includes(search.toLowerCase()) ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.id.toLowerCase().includes(search.toLowerCase()) ||
        (s.discordGuildId || "").toLowerCase().includes(search.toLowerCase())
    )

    const handleDelete = async () => {
        if (!deletingId) return
        setUpdatingId(deletingId)
        try {
            const res = await fetch(`/api/admin/super/servers/${deletingId}`, {
                method: "DELETE"
            })

            if (res.ok) {
                setServers(servers.filter(s => s.id !== deletingId))
                setDeletingId(null)
                router.refresh()
            } else {
                alert("Failed to delete server.")
            }
        } catch (e) {
            alert("An error occurred.")
        } finally {
            setUpdatingId(null)
        }
    }

    const onUpdate = (updatedServer: any) => {
        setServers(servers.map(s => s.id === updatedServer.id ? { ...s, ...updatedServer } : s))
    }

    return (
        <div>
            {/* Toolbar */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#111]">
                <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                        placeholder="Search by name, ID or Guild..."
                        className="pl-9 bg-zinc-900 border-zinc-800 focus-visible:ring-zinc-700 h-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="text-xs text-zinc-500 font-medium">
                    Total Servers: <span className="text-white font-bold">{servers.length}</span>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-400">
                    <thead className="bg-[#111] text-xs uppercase text-zinc-500 border-b border-white/5">
                        <tr>
                            <th className="px-6 py-4 font-medium">Server Identity</th>
                            <th className="px-6 py-4 font-medium">Platform Stats</th>
                            <th className="px-6 py-4 font-medium">Access & Billing</th>
                            <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredServers.map((server) => (
                            <tr key={server.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-white group-hover:text-emerald-400 transition-colors">{server.customName || server.name}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] font-mono text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">{server.id}</span>
                                        {server.discordGuildId && (
                                            <span className="text-[10px] font-mono text-indigo-400/70 bg-indigo-500/5 px-1.5 py-0.5 rounded border border-indigo-500/10 flex items-center gap-1">
                                                <Shield className="h-2.5 w-2.5" /> {server.discordGuildId}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 text-xs">
                                            <Shield className="h-3 w-3 text-zinc-500" />
                                            <span>{server._count.members} Members</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <ExternalLink className="h-3 w-3 text-zinc-500" />
                                            <span>{server._count.logs.toLocaleString()} Logs</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                                            <Calendar className="h-2.5 w-2.5" />
                                            <span>Added {new Date(server.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`h-1.5 w-1.5 rounded-full ${server.subscriptionPlan === 'pow-max' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' :
                                                    server.subscriptionPlan === 'pow-pro' ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]' :
                                                        'bg-zinc-500'
                                                }`} />
                                            <span className="capitalize text-zinc-300 font-bold text-xs tracking-wide">
                                                {server.subscriptionPlan || "free"}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono bg-black/20 p-1 rounded border border-white/5 truncate max-w-[180px]">
                                            <User className="h-2.5 w-2.5 shrink-0" />
                                            <span className="truncate">{server.subscriberUserId || "No Owner"}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <Link
                                            href={`/dashboard/${server.id}/admin`}
                                            className="h-8 px-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-lg border border-white/5 transition-all"
                                        >
                                            Dashboard
                                        </Link>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0 border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:text-emerald-400"
                                            onClick={() => setEditingServer(server)}
                                        >
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0 border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:text-red-400"
                                            onClick={() => setDeletingId(server.id)}
                                            disabled={updatingId === server.id}
                                        >
                                            {updatingId === server.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredServers.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <Search className="h-8 w-8 text-zinc-800" />
                                        <p>No servers found matching "{search}"</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {editingServer && (
                <SuperServerEditModal
                    server={editingServer}
                    isOpen={!!editingServer}
                    onClose={() => setEditingServer(null)}
                    onUpdate={onUpdate}
                />
            )}

            <ConfirmModal
                isOpen={!!deletingId}
                onClose={() => setDeletingId(null)}
                onConfirm={handleDelete}
                title="Delete Server?"
                description="This action is permanent. All logs, members, and configurations for this community will be erased from our database."
                confirmLabel="Delete Community"
                isDestructive={true}
                isLoading={updatingId === deletingId}
            />
        </div>
    )
}
