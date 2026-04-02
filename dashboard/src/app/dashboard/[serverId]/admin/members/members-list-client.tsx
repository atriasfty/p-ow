
"use client"

import { useState, useEffect, useRef } from "react"
import { RefreshCw, User, Shield, Loader2, Search, Copy, Check, BarChart3, X } from "lucide-react"
import { ShiftHeatmap } from "@/components/admin/shift-heatmap"

interface Role {
    id: string
    name: string
    color: string
}

interface ClerkUser {
    id: string
    username: string | null
    name: string | null
    image: string
    discordId?: string
    discordUsername?: string
    robloxId?: string
    robloxUsername?: string
}

interface ExistingMember {
    id: string
    userId: string
    isAdmin: boolean
    role: Role | null
    shifts?: { startTime: string | Date, endTime: string | Date | null }[]
}

interface Server {
    id: string
    name: string
    customName: string | null
}

interface MembersListClientProps {
    serverId: string
    roles: Role[]
    servers: Server[]
    existingMembers: ExistingMember[]
}

export function MembersListClient({ serverId, roles, servers, existingMembers }: MembersListClientProps) {
    const [users, setUsers] = useState<ClerkUser[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [updating, setUpdating] = useState<string | null>(null)
    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [memberMap, setMemberMap] = useState<Record<string, ExistingMember>>({})
    const [copiedUserId, setCopiedUserId] = useState<string | null>(null)
    const [viewingHeatmapUser, setViewingHeatmapUser] = useState<{ id: string, name: string } | null>(null)

    // Pagination state
    const [page, setPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const limit = 50

    const isMounted = useRef(true)

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
            setPage(1) // Reset to first page on search
        }, 500)
        return () => clearTimeout(timer)
    }, [search])

    // Build member map from existing members
    useEffect(() => {
        const map: Record<string, ExistingMember> = {}
        existingMembers.forEach(m => {
            map[m.userId] = m
        })
        setMemberMap(map)
    }, [existingMembers])

    // Fetch Clerk users with pagination and search
    useEffect(() => {
        isMounted.current = true

        const fetchUsers = async () => {
            setLoading(true)
            try {
                const offset = (page - 1) * limit
                const res = await fetch(`/api/admin/server-users?serverId=${serverId}&limit=${limit}&offset=${offset}&search=${encodeURIComponent(debouncedSearch)}`)
                if (res.ok && isMounted.current) {
                    const data = await res.json()
                    setUsers(data.users)
                    setTotalCount(data.totalCount || 0)
                }
            } catch (e) {
                console.error("Error fetching users:", e)
            } finally {
                if (isMounted.current) {
                    setLoading(false)
                }
            }
        }

        fetchUsers()

        return () => {
            isMounted.current = false
        }
    }, [page, debouncedSearch])

    // Find member record for a user
    const getMemberForUser = (user: ClerkUser): ExistingMember | null => {
        return memberMap[user.id] ||
            (user.discordId && memberMap[user.discordId]) ||
            (user.robloxId && memberMap[user.robloxId]) ||
            null
    }

    const handleRoleChange = async (user: ClerkUser, roleId: string | null, isAdmin?: boolean) => {
        setUpdating(user.id)
        const userId = user.robloxId || user.discordId || user.id
        const member = getMemberForUser(user)

        try {
            if (member) {
                await fetch("/api/admin/members/role", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ memberId: member.id, roleId, isAdmin })
                })
            } else {
                await fetch("/api/admin/members", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ serverId, userId, roleId })
                })
            }

            const res = await fetch(`/api/admin/members?serverId=${serverId}`)
            if (res.ok) {
                const data = await res.json()
                const newMap: Record<string, ExistingMember> = {}
                data.members.forEach((m: ExistingMember) => {
                    newMap[m.userId] = m
                })
                setMemberMap(newMap)
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
            await fetch("/api/admin/members/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serverId })
            })
            window.location.reload()
        } catch (e) {
            console.error("Error syncing roles:", e)
        } finally {
            setSyncing(false)
        }
    }

    const totalPages = Math.ceil(totalCount / limit)

    return (
        <div className="space-y-4">
            {/* Search and Sync */}
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search members..."
                        className="w-full bg-[#222] border border-[#333] rounded-lg pl-10 pr-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                </div>
                {servers.length > 1 && (
                    <button
                        onClick={handleSyncRoles}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                    >
                        {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Sync Roles
                    </button>
                )}
            </div>

            {/* Members Table */}
            <div className="bg-[#1a1a1a] rounded-xl border border-[#222] overflow-hidden relative">
                {loading && (
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-10">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                    </div>
                )}
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-[#222]">
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">User</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Discord</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Roblox</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Role</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Admin</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Last Seen</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Stats</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 && !loading ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                                    No members found
                                </td>
                            </tr>
                        ) : (
                            users.map(user => {
                                const member = getMemberForUser(user)
                                return (
                                    <tr key={user.id} className="border-b border-[#222] last:border-0 hover:bg-white/5">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={user.image}
                                                    alt=""
                                                    className="h-8 w-8 rounded-full"
                                                />
                                                <div>
                                                    <div className="text-sm font-medium text-white">
                                                        {user.name || user.username || "Unknown"}
                                                    </div>
                                                    {user.username && (
                                                        <div className="text-xs text-zinc-500">@{user.username}</div>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(user.id)
                                                            setCopiedUserId(user.id)
                                                            setTimeout(() => setCopiedUserId(null), 2000)
                                                        }}
                                                        className="flex items-center gap-1 mt-1 text-[10px] font-mono text-zinc-600 hover:text-zinc-300 transition-colors group/copy"
                                                        title="Click to copy Clerk User ID"
                                                    >
                                                        {copiedUserId === user.id ? (
                                                            <><Check className="h-2.5 w-2.5 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
                                                        ) : (
                                                            <><Copy className="h-2.5 w-2.5 opacity-0 group-hover/copy:opacity-100" />{user.id}</>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.discordUsername ? (
                                                <span className="text-sm text-indigo-400">{user.discordUsername}</span>
                                            ) : (
                                                <span className="text-xs text-zinc-600">Not linked</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.robloxUsername ? (
                                                <span className="text-sm text-emerald-400">{user.robloxUsername}</span>
                                            ) : (
                                                <span className="text-xs text-zinc-600">Not linked</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={member?.role?.id || ""}
                                                onChange={(e) => handleRoleChange(user, e.target.value || null)}
                                                disabled={updating === user.id}
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
                                            {member ? (
                                                <button
                                                    onClick={() => handleRoleChange(user, member.role?.id || null, !member.isAdmin)}
                                                    disabled={updating === user.id}
                                                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors disabled:opacity-50 ${member.isAdmin
                                                        ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                                                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                                        }`}
                                                >
                                                    <Shield className="h-3 w-3" />
                                                    {member.isAdmin ? "Admin" : "Make Admin"}
                                                </button>
                                            ) : (
                                                <span className="text-xs text-zinc-600">Assign role first</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {member?.shifts && member.shifts.length > 0 ? (
                                                member.shifts[0].endTime ? (
                                                    <span className="text-xs text-zinc-400">
                                                        {new Date(member.shifts[0].endTime).toLocaleDateString()}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">
                                                        On Duty
                                                    </span>
                                                )
                                            ) : (
                                                <span className="text-xs text-zinc-600">Never</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => setViewingHeatmapUser({ id: user.id, name: user.name || user.username || "User" })}
                                                className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                                                title="View shift activity heatmap"
                                            >
                                                <BarChart3 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-zinc-500">
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount} members
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Previous
                    </button>
                    <div className="flex items-center px-3 text-xs font-medium text-zinc-400">
                        Page {page} of {totalPages || 1}
                    </div>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || totalPages === 0 || loading}
                        className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Next
                    </button>
                </div>
            </div>

            {/* Heatmap Modal */}
            {viewingHeatmapUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-4xl bg-[#1a1a1a] rounded-2xl border border-[#333] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-[#222] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                    <BarChart3 className="h-5 w-5 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">{viewingHeatmapUser.name} - Activity</h3>
                                    <p className="text-xs text-zinc-500">Overview of staff shift performance</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setViewingHeatmapUser(null)}
                                className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <ShiftHeatmap
                                serverId={serverId}
                                userId={viewingHeatmapUser.id}
                                userName={viewingHeatmapUser.name}
                            />
                        </div>
                        <div className="px-6 py-4 bg-[#222] border-t border-[#333] flex justify-end">
                            <button
                                onClick={() => setViewingHeatmapUser(null)}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
