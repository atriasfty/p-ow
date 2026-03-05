
"use client"

import { useState, useEffect, useRef } from "react"
import { Check, X, Clock, Loader2, User, Calendar, Trash2, AlertTriangle } from "lucide-react"

interface LeaveOfAbsence {
    id: string
    userId: string
    robloxUsername: string | null
    startDate: Date
    endDate: Date
    reason: string
    status: string
    reviewedBy: string | null
    createdAt: Date
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

interface LoaListProps {
    serverId: string
    pending: LeaveOfAbsence[]
    active: LeaveOfAbsence[]
    past: LeaveOfAbsence[]
}

export function LoaList({ serverId, pending: initialPending, active: initialActive, past: initialPast }: LoaListProps) {
    const [pending, setPending] = useState(initialPending)
    const [active, setActive] = useState(initialActive)
    const [pastLoas, setPastLoas] = useState(initialPast)
    const [processing, setProcessing] = useState<string | null>(null)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [users, setUsers] = useState<ClerkUser[]>([])
    const [loadingUsers, setLoadingUsers] = useState(true)
    const isMounted = useRef(true)

    // Confirmation modal state
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean
        loaId: string
        listType: "pending" | "active" | "past"
        userName: string
    } | null>(null)

    // Fetch all Clerk users to map userIds to Roblox usernames
    useEffect(() => {
        isMounted.current = true

        const fetchUsers = async () => {
            try {
                const res = await fetch("/api/admin/users")
                if (res.ok && isMounted.current) {
                    const data = await res.json()
                    setUsers(data.users)
                }
            } catch (e) {
                console.error("Error fetching users:", e)
            } finally {
                if (isMounted.current) {
                    setLoadingUsers(false)
                }
            }
        }

        fetchUsers()

        return () => {
            isMounted.current = false
        }
    }, [])

    // Get Roblox username for a userId
    const getRobloxUsername = (userId: string): string => {
        const user = users.find(u =>
            u.id === userId ||
            u.discordId === userId ||
            u.robloxId === userId
        )

        if (user?.robloxUsername) {
            return user.robloxUsername
        }
        if (user?.name || user?.username) {
            return user.name || user.username || userId
        }
        return userId
    }

    // Get user avatar
    const getUserAvatar = (userId: string): string | null => {
        const user = users.find(u =>
            u.id === userId ||
            u.discordId === userId ||
            u.robloxId === userId
        )
        return user?.image || null
    }

    const handleAction = async (loaId: string, action: "approve" | "decline") => {
        setProcessing(loaId)

        try {
            const res = await fetch(`/api/loa/${loaId}/${action}`, {
                method: "POST"
            })

            if (res.ok) {
                const loa = pending.find(l => l.id === loaId)
                setPending(prev => prev.filter(l => l.id !== loaId))

                if (action === "approve" && loa) {
                    setActive(prev => [...prev, { ...loa, status: "approved" }])
                }
            }
        } catch (e) {
            console.error("Error processing LOA:", e)
        } finally {
            setProcessing(null)
        }
    }

    const handleDelete = async (loaId: string, listType: "pending" | "active" | "past") => {
        setDeleting(loaId)
        setConfirmModal(null)

        try {
            const res = await fetch(`/api/loa/${loaId}`, {
                method: "DELETE"
            })

            if (res.ok) {
                if (listType === "pending") {
                    setPending(prev => prev.filter(l => l.id !== loaId))
                } else if (listType === "active") {
                    setActive(prev => prev.filter(l => l.id !== loaId))
                } else {
                    setPastLoas(prev => prev.filter(l => l.id !== loaId))
                }
            }
        } catch (e) {
            console.error("Error deleting LOA:", e)
        } finally {
            setDeleting(null)
        }
    }

    const openDeleteConfirm = (loaId: string, listType: "pending" | "active" | "past", userId: string) => {
        setConfirmModal({
            open: true,
            loaId,
            listType,
            userName: getRobloxUsername(userId)
        })
    }

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        })
    }

    // User display component
    const UserDisplay = ({ loa }: { loa: LeaveOfAbsence }) => {
        const avatar = getUserAvatar(loa.userId)
        const name = loa.robloxUsername || getRobloxUsername(loa.userId)

        return (
            <div className="flex items-center gap-2">
                {avatar ? (
                    <img src={avatar} alt="" className="h-6 w-6 rounded-full" />
                ) : (
                    <div className="h-6 w-6 rounded-full bg-zinc-700 flex items-center justify-center">
                        <User className="h-3 w-3 text-zinc-400" />
                    </div>
                )}
                <div className="flex flex-col">
                    <span className="text-sm text-white font-medium">{name}</span>
                    {loa.userId.startsWith("user_") && (
                        <span className="text-[10px] text-zinc-500 font-mono">{loa.userId}</span>
                    )}
                </div>
            </div>
        )
    }

    if (loadingUsers) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Pending */}
            <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Pending Requests ({pending.length})
                </h3>

                {pending.length === 0 ? (
                    <p className="text-sm text-zinc-600 py-4 text-center bg-[#1a1a1a] rounded-xl border border-[#222]">
                        No pending requests
                    </p>
                ) : (
                    <div className="space-y-2">
                        {pending.map(loa => (
                            <div
                                key={loa.id}
                                className="bg-[#1a1a1a] rounded-xl border border-amber-500/20 p-4"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="mb-2">
                                            <UserDisplay loa={loa} />
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                                            <Calendar className="h-3 w-3" />
                                            {formatDate(loa.startDate)} → {formatDate(loa.endDate)}
                                        </div>
                                        <p className="text-sm text-zinc-400">{loa.reason}</p>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() => handleAction(loa.id, "approve")}
                                            disabled={processing === loa.id}
                                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm transition-colors disabled:opacity-50"
                                        >
                                            {processing === loa.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleAction(loa.id, "decline")}
                                            disabled={processing === loa.id}
                                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm transition-colors disabled:opacity-50"
                                        >
                                            <X className="h-4 w-4" />
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Active */}
            <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" />
                    Active LOAs ({active.length})
                </h3>

                {active.length === 0 ? (
                    <p className="text-sm text-zinc-600 py-4 text-center bg-[#1a1a1a] rounded-xl border border-[#222]">
                        No active LOAs
                    </p>
                ) : (
                    <div className="bg-[#1a1a1a] rounded-xl border border-[#222] overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[#222]">
                                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">User</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Period</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Reason</th>
                                    <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {active.map(loa => (
                                    <tr key={loa.id} className="border-b border-[#222] last:border-0">
                                        <td className="px-4 py-3">
                                            <UserDisplay loa={loa} />
                                        </td>
                                        <td className="px-4 py-3 text-xs text-zinc-400">
                                            {formatDate(loa.startDate)} → {formatDate(loa.endDate)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-zinc-400">{loa.reason}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => openDeleteConfirm(loa.id, "active", loa.userId)}
                                                disabled={deleting === loa.id}
                                                className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-50"
                                            >
                                                {deleting === loa.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Past */}
            {pastLoas.length > 0 && (
                <div>
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Past LOAs ({pastLoas.length})</h3>
                    <div className="bg-[#1a1a1a] rounded-xl border border-[#222] overflow-hidden opacity-60">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[#222]">
                                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">User</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Period</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pastLoas.slice(0, 10).map((loa: LeaveOfAbsence) => (
                                    <tr key={loa.id} className="border-b border-[#222] last:border-0">
                                        <td className="px-4 py-3">
                                            <UserDisplay loa={loa} />
                                        </td>
                                        <td className="px-4 py-3 text-xs text-zinc-400">
                                            {formatDate(loa.startDate)} → {formatDate(loa.endDate)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-1 rounded ${loa.status === "approved" ? "bg-emerald-500/10 text-emerald-400"
                                                : "bg-red-500/10 text-red-400"
                                                }`}>
                                                {loa.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-[#333] overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-[#222]">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <AlertTriangle className="h-6 w-6 text-red-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">Delete LOA</h3>
                                    <p className="text-sm text-zinc-400">This action cannot be undone</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <p className="text-zinc-300">
                                Are you sure you want to delete the LOA for <span className="font-semibold text-white">{confirmModal.userName}</span>?
                            </p>
                        </div>

                        <div className="p-6 border-t border-[#222] flex gap-3 justify-end">
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(confirmModal.loaId, confirmModal.listType)}
                                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors flex items-center gap-2"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete LOA
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
