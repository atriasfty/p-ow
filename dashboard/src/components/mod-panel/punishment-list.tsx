"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { MoreVertical, Pencil, Trash2, User, X, Check, Loader2, CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react"
import Link from "next/link"
import { usePermissions } from "@/components/auth/role-sync-wrapper"

interface Punishment {
    id: string
    userId: string
    type: string
    reason: string | null
    resolved: boolean
    createdAt: Date | string
    moderatorId: string
}

interface UserData {
    name: string
    displayName: string
    avatar: string | null
}

export function PunishmentList({ serverId, initialPunishments }: { serverId: string, initialPunishments: Punishment[] }) {
    const [punishments, setPunishments] = useState(initialPunishments)
    const [userCache, setUserCache] = useState<Map<string, UserData>>(new Map())
    const [openMenu, setOpenMenu] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editReason, setEditReason] = useState("")
    const [loading, setLoading] = useState<string | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const { permissions } = usePermissions()

    // Pagination state
    const [hasMore, setHasMore] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [cursor, setCursor] = useState<string | null>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // Confirmation modal state
    const [confirmModal, setConfirmModal] = useState<{
        type: "delete" | "complete"
        id: string
        userName: string
    } | null>(null)

    // Sort to put uncompleted ban bolos first
    const sortedPunishments = [...punishments].sort((a, b) => {
        const aIsUnresolvedBolo = a.type === "Ban Bolo" && !a.resolved
        const bIsUnresolvedBolo = b.type === "Ban Bolo" && !b.resolved

        if (aIsUnresolvedBolo && !bIsUnresolvedBolo) return -1
        if (!aIsUnresolvedBolo && bIsUnresolvedBolo) return 1

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    // Load more punishments
    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return

        setLoadingMore(true)
        try {
            const params = new URLSearchParams({ serverId, limit: "30" })
            if (cursor) params.append("cursor", cursor)

            const res = await fetch(`/api/punishments?${params}`)
            if (res.ok) {
                const data = await res.json()
                setPunishments(prev => {
                    // Merge and dedupe
                    const existing = new Set(prev.map(p => p.id))
                    const newItems = data.items.filter((p: Punishment) => !existing.has(p.id))
                    return [...prev, ...newItems]
                })
                setHasMore(data.hasMore)
                setCursor(data.nextCursor)
            }
        } catch (e) {
            console.error("Failed to load more punishments:", e)
        } finally {
            setLoadingMore(false)
        }
    }, [serverId, cursor, hasMore, loadingMore])

    // Lazy loading on scroll
    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container
            // Load more when 200px from bottom
            if (scrollHeight - scrollTop - clientHeight < 200 && hasMore && !loadingMore) {
                loadMore()
            }
        }

        container.addEventListener("scroll", handleScroll)
        return () => container.removeEventListener("scroll", handleScroll)
    }, [loadMore, hasMore, loadingMore])

    // Fetch user data for all punishments via server API
    useEffect(() => {
        const fetchUserData = async () => {
            const userIds = [...new Set(punishments.map(p => p.userId))]
            const uncachedIds = userIds.filter(id => !userCache.has(id))

            if (uncachedIds.length === 0) return

            try {
                const res = await fetch("/api/roblox/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIds: uncachedIds })
                })

                if (res.ok) {
                    const data = await res.json()
                    setUserCache(prev => {
                        const newCache = new Map(prev)
                        for (const [id, userData] of Object.entries(data)) {
                            newCache.set(id, userData as UserData)
                        }
                        return newCache
                    })
                }
            } catch (e) {
                console.warn("Failed to fetch user data:", e)
            }
        }
        fetchUserData()
    }, [punishments])

    // Refresh only new punishments periodically (don't refetch all)
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/punishments?serverId=${serverId}&limit=10`)
                if (res.ok) {
                    const data = await res.json()
                    setPunishments(prev => {
                        // Merge new items at the beginning
                        const existing = new Set(prev.map(p => p.id))
                        const newItems = data.items.filter((p: Punishment) => !existing.has(p.id))
                        if (newItems.length > 0) {
                            return [...newItems, ...prev]
                        }
                        return prev
                    })
                }
            } catch (e) {
                console.error("Failed to sync punishments:", e)
            }
        }, 15000) // 15s sync for new items

        return () => clearInterval(interval)
    }, [serverId])

    // Close menu on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenu(null)
            }
        }
        document.addEventListener("click", handleClick)
        return () => document.removeEventListener("click", handleClick)
    }, [])

    const handleDelete = async (id: string) => {
        setLoading(id)
        setConfirmModal(null)
        try {
            const res = await fetch(`/api/punishments/${id}`, { method: "DELETE" })
            if (res.ok) {
                setPunishments(prev => prev.filter(p => p.id !== id))
            }
        } catch (e) {
            console.error("Delete failed:", e)
        } finally {
            setLoading(null)
            setOpenMenu(null)
        }
    }

    const handleComplete = async (id: string) => {
        setLoading(id)
        setConfirmModal(null)
        try {
            const res = await fetch(`/api/punishments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resolved: true })
            })
            if (res.ok) {
                setPunishments(prev => prev.map(p => p.id === id ? { ...p, resolved: true } : p))
            }
        } catch (e) {
            console.error("Complete failed:", e)
        } finally {
            setLoading(null)
            setOpenMenu(null)
        }
    }

    const handleEdit = async (id: string) => {
        setLoading(id)
        try {
            const res = await fetch(`/api/punishments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: editReason })
            })
            if (res.ok) {
                setPunishments(prev => prev.map(p => p.id === id ? { ...p, reason: editReason } : p))
                setEditingId(null)
            }
        } catch (e) {
            console.error("Edit failed:", e)
        } finally {
            setLoading(null)
        }
    }

    const getTypeColor = (type: string) => {
        switch (type) {
            case "Ban": return "border-red-500 text-red-500"
            case "Kick": return "border-amber-500 text-amber-500"
            case "Ban Bolo": return "border-yellow-500 text-yellow-500"
            default: return "border-blue-500 text-blue-500"
        }
    }

    // Permission check moved into JSX to avoid hooks order violation
    if (!permissions.canViewPunishments) {
        return <div className="p-4 text-center text-zinc-500 text-sm">You do not have permission to view punishments.</div>
    }

    return (
        <>
            <div ref={scrollContainerRef} className="p-2 space-y-2 overflow-y-auto flex-1">
                {punishments.length === 0 ? (
                    <div className="text-center text-zinc-500 text-sm py-8">No punishments yet</div>
                ) : (
                    <>
                        {sortedPunishments.map(p => {
                            const user = userCache.get(p.userId)
                            const typeColor = getTypeColor(p.type)
                            const borderColor = typeColor.split(" ")[0]
                            const isUnresolvedBolo = p.type === "Ban Bolo" && !p.resolved

                            return (
                                <div
                                    key={p.id}
                                    className={`rounded-lg p-3 ${isUnresolvedBolo
                                        ? "bg-yellow-500/10 border-2 border-yellow-500/60 ring-1 ring-yellow-500/30"
                                        : `bg-[#222] ${borderColor} border-l-2`
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold uppercase ${typeColor.split(" ")[1]}`}>{p.type}</span>
                                            {p.type === "Ban Bolo" && p.resolved && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                                                    Completed
                                                </span>
                                            )}
                                        </div>

                                        {(
                                            (p.type === "Warn" && permissions.canIssueWarnings) ||
                                            (p.type === "Kick" && permissions.canKick) ||
                                            (p.type === "Ban" && permissions.canBan) ||
                                            (p.type === "Ban Bolo" && permissions.canBanBolo)
                                        ) && (
                                                <div className="relative" ref={openMenu === p.id ? menuRef : null}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setOpenMenu(openMenu === p.id ? null : p.id)
                                                        }}
                                                        className="p-1 rounded hover:bg-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                                        aria-label={`Manage punishment for ${user?.name || p.userId}`}
                                                        title={`Manage punishment for ${user?.name || p.userId}`}
                                                    >
                                                        <MoreVertical className="h-3 w-3 text-zinc-500" />
                                                    </button>
                                                    {openMenu === p.id && (
                                                        <div className="absolute right-0 top-6 bg-[#2a2a2a] border border-[#333] rounded-lg shadow-xl z-50 py-1 min-w-[130px]">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingId(p.id)
                                                                    setEditReason(p.reason || "")
                                                                    setOpenMenu(null)
                                                                }}
                                                                className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700 flex items-center gap-2 focus-visible:outline-none focus-visible:bg-zinc-700"
                                                                aria-label={`Edit reason for ${user?.name || p.userId}`}
                                                            >
                                                                <Pencil className="h-3 w-3" /> Edit Reason
                                                            </button>
                                                            {p.type === "Ban Bolo" && !p.resolved && (
                                                                <button
                                                                    onClick={() => {
                                                                        setConfirmModal({
                                                                            type: "complete",
                                                                            id: p.id,
                                                                            userName: user?.name || p.userId
                                                                        })
                                                                        setOpenMenu(null)
                                                                    }}
                                                                    className="w-full px-3 py-1.5 text-left text-xs text-emerald-400 hover:bg-zinc-700 flex items-center gap-2 focus-visible:outline-none focus-visible:bg-zinc-700"
                                                                    aria-label={`Complete ban bolo for ${user?.name || p.userId}`}
                                                                >
                                                                    <CheckCircle2 className="h-3 w-3" /> Complete
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    setConfirmModal({
                                                                        type: "delete",
                                                                        id: p.id,
                                                                        userName: user?.name || p.userId
                                                                    })
                                                                    setOpenMenu(null)
                                                                }}
                                                                className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-zinc-700 flex items-center gap-2 focus-visible:outline-none focus-visible:bg-zinc-700"
                                                                aria-label={`Delete punishment for ${user?.name || p.userId}`}
                                                            >
                                                                <Trash2 className="h-3 w-3" /> Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                    </div>

                                    <Link
                                        href={`/dashboard/${serverId}/user/${encodeURIComponent(user?.name || p.userId)}`}
                                        className="flex items-center gap-2 mb-2 group"
                                    >
                                        <div className="h-6 w-6 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0">
                                            {user?.avatar ? (
                                                <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <User className="h-full w-full p-1 text-zinc-500" />
                                            )}
                                        </div>
                                        <span className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors truncate">
                                            {user?.name || p.userId}
                                        </span>
                                    </Link>

                                    <div className="space-y-1 text-xs text-zinc-400">
                                        {editingId === p.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editReason}
                                                    onChange={(e) => setEditReason(e.target.value)}
                                                    className="flex-1 bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-indigo-500"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleEdit(p.id)}
                                                    disabled={loading === p.id}
                                                    className="p-1 rounded bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                                    aria-label={`Save reason for ${user?.name || p.userId}`}
                                                    title={loading === p.id ? "Saving..." : "Save reason"}
                                                >
                                                    {loading === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="p-1 rounded bg-red-500/20 text-red-500 hover:bg-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                                    aria-label="Cancel editing reason"
                                                    title="Cancel"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <p>Reason: <span className="text-zinc-300">{p.reason}</span></p>
                                        )}
                                        <p className="text-[10px] text-zinc-600">{new Date(p.createdAt).toLocaleString()}</p>
                                    </div>
                                </div>
                            )
                        })}

                        {/* Load more indicator */}
                        {hasMore && (
                            <div className="py-4 flex justify-center">
                                {loadingMore ? (
                                    <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
                                ) : (
                                    <button
                                        onClick={loadMore}
                                        className="flex items-center gap-2 text-xs text-zinc-500 hover:text-white transition-colors"
                                    >
                                        <ChevronDown className="h-4 w-4" />
                                        Load more
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Confirmation Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-[#333] overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-[#222]">
                            <div className="flex items-center gap-3">
                                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${confirmModal.type === "delete" ? "bg-red-500/10" : "bg-emerald-500/10"
                                    }`}>
                                    {confirmModal.type === "delete" ? (
                                        <AlertTriangle className="h-6 w-6 text-red-400" />
                                    ) : (
                                        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">
                                        {confirmModal.type === "delete" ? "Delete Punishment" : "Complete Ban Bolo"}
                                    </h3>
                                    <p className="text-sm text-zinc-400">
                                        {confirmModal.type === "delete"
                                            ? "This action cannot be undone"
                                            : "Mark this ban bolo as completed"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <p className="text-zinc-300">
                                {confirmModal.type === "delete"
                                    ? <>Are you sure you want to delete this punishment for <span className="font-semibold text-white">{confirmModal.userName}</span>?</>
                                    : <>Mark the ban bolo for <span className="font-semibold text-white">{confirmModal.userName}</span> as completed?</>
                                }
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
                                onClick={() => confirmModal.type === "delete"
                                    ? handleDelete(confirmModal.id)
                                    : handleComplete(confirmModal.id)
                                }
                                disabled={loading === confirmModal.id}
                                className={`px-4 py-2 rounded-lg text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 ${confirmModal.type === "delete"
                                    ? "bg-red-500 hover:bg-red-600"
                                    : "bg-emerald-500 hover:bg-emerald-600"
                                    }`}
                            >
                                {loading === confirmModal.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : confirmModal.type === "delete" ? (
                                    <Trash2 className="h-4 w-4" />
                                ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                )}
                                {confirmModal.type === "delete" ? "Delete" : "Complete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
