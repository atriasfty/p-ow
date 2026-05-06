import { apiFetch } from "@/lib/api-fetch"

"use client"

import { useState } from "react"
import { RefreshCw, User, Shield, Loader2 } from "lucide-react"

interface Role {
    id: string
    name: string
    color: string
}

interface Member {
    id: string
    userId: string
    isAdmin: boolean
    role: Role | null
    createdAt: Date
}

interface Server {
    id: string
    name: string
    customName: string | null
}

interface MembersListProps {
    serverId: string
    members: Member[]
    roles: Role[]
    servers: Server[]
}

export function MembersList({ serverId, members: initialMembers, roles, servers }: MembersListProps) {
    const [members, setMembers] = useState(initialMembers)
    const [syncing, setSyncing] = useState(false)
    const [updating, setUpdating] = useState<string | null>(null)

    const handleRoleChange = async (memberId: string, roleId: string | null) => {
        setUpdating(memberId)

        try {
            const res = await apiFetch("/api/admin/members/role", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ memberId, roleId })
            })

            if (res.ok) {
                setMembers(prev => prev.map(m =>
                    m.id === memberId
                        ? { ...m, role: roleId ? roles.find(r => r.id === roleId) || null : null }
                        : m
                ))
            }
        } catch (e) {
            console.error("Error updating role:", e)
        } finally {
            setUpdating(null)
        }
    }

    const handleSyncRoles = async () => {
        setSyncing(true)

        try {
            const res = await apiFetch("/api/admin/members/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serverId })
            })

            if (res.ok) {
                window.location.reload()
            }
        } catch (e) {
            console.error("Error syncing roles:", e)
        } finally {
            setSyncing(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Sync Button */}
            {servers.length > 1 && (
                <div className="flex justify-end">
                    <button
                        onClick={handleSyncRoles}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                    >
                        {syncing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                        Sync Roles Between Servers
                    </button>
                </div>
            )}

            {/* Members Table */}
            <div className="bg-[#1a1a1a] rounded-xl border border-[#222] overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-[#222]">
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">User ID</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Role</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Admin</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        {members.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                                    No members yet
                                </td>
                            </tr>
                        ) : (
                            members.map(member => (
                                <tr key={member.id} className="border-b border-[#222] last:border-0 hover:bg-white/5">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-zinc-500" />
                                            <span className="text-sm font-mono text-white">{member.userId}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <select
                                            value={member.role?.id || ""}
                                            onChange={(e) => handleRoleChange(member.id, e.target.value || null)}
                                            disabled={updating === member.id}
                                            className="bg-[#222] border border-[#333] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                                        >
                                            <option value="">No Role</option>
                                            {roles.map(role => (
                                                <option key={role.id} value={role.id}>
                                                    {role.name}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-4 py-3">
                                        {member.isAdmin && (
                                            <span className="flex items-center gap-1 text-xs text-amber-400">
                                                <Shield className="h-3 w-3" />
                                                Admin
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-zinc-500">
                                        {new Date(member.createdAt).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
