
"use client"

import { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react"
import { ScrollText, Sword, Terminal, LogOut, Loader2, Lock } from "lucide-react"
import Link from "next/link"
import { usePermissions } from "@/components/auth/role-sync-wrapper"
import { useServerEventsContextSafe } from "@/components/providers/server-events-provider"

interface LogItem {
    id: string
    _type: string
    // Parsed fields from API
    PlayerName?: string
    PlayerId?: string
    KillerName?: string
    KillerId?: string
    VictimName?: string
    VictimId?: string
    Command?: string
    Arguments?: string
    Join?: boolean
    timestamp?: number
    Timestamp?: number
    [key: string]: any
}

export function LogViewer({ serverId, compact = false, userId, username }: { serverId: string, compact?: boolean, userId?: string, username?: string }) {
    const { permissions } = usePermissions()

    // ALL HOOKS MUST BE DECLARED BEFORE ANY EARLY RETURNS
    const [logs, setLogs] = useState<LogItem[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [filter, setFilter] = useState<"all" | "join" | "kill" | "command">("all")
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const snapshotRef = useRef<{ scrollHeight: number, scrollTop: number } | null>(null)
    const LIMIT = 50

    // Debounce the search query (500ms delay)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query)
        }, 500)
        return () => clearTimeout(timer)
    }, [query])

    // Capture scroll state before updates
    const captureSnapshot = () => {
        if (scrollContainerRef.current) {
            snapshotRef.current = {
                scrollHeight: scrollContainerRef.current.scrollHeight,
                scrollTop: scrollContainerRef.current.scrollTop
            }
        }
    }

    // Restore/Adjust scroll position after log updates (Scroll Compensation)
    useLayoutEffect(() => {
        if (!snapshotRef.current || !scrollContainerRef.current) return

        const { scrollHeight: prevHeight, scrollTop: prevTop } = snapshotRef.current
        const container = scrollContainerRef.current

        // Only compensate if user was scrolled down (viewing history)
        // If they were at top (prevTop close to 0), we usually let them see new content, 
        // BUT user asked "don't autoscroll... keep me where i am".
        // Actually for a log, usually if you are at top, you WANT to see new logs.
        // User complaint: "if i scroll down... it continues autoscrolling up".
        // This implies they ARE scrolled down.
        if (prevTop > 10) {
            const diff = container.scrollHeight - prevHeight
            if (diff > 0) {
                // Content added at top, push scroll down to maintain visual position
                container.scrollTop = prevTop + diff
            }
        } else {
            // Optional: If user was at 0, keep at 0? (Standard behavior does this anyway)
        }

        snapshotRef.current = null
    }, [logs])

    // Fetch initial logs
    const fetchLogs = useCallback(async (reset = false) => {
        if (reset) {
            setLoading(true)
            setLogs([])
            setHasMore(true)
        } else {
            // If polling, capture snapshot
            captureSnapshot()
        }

        try {
            // Build URL with all params
            const params = new URLSearchParams({
                serverId,
                type: filter,
                limit: String(LIMIT),
                offset: "0"
            })
            if (userId) params.set("userId", userId)
            if (username) params.set("username", username)
            if (debouncedQuery) params.set("query", debouncedQuery)

            const url = `/api/logs?${params.toString()}`
            const res = await fetch(url)
            if (res.ok) {
                const newLogs = await res.json()

                if (reset) {
                    setLogs(newLogs)
                    setHasMore(newLogs.length >= LIMIT)
                } else {
                    // Merge: Only add logs that don't exist (when polling without search)
                    // If searching, always reset
                    if (debouncedQuery) {
                        setLogs(newLogs)
                        setHasMore(newLogs.length >= LIMIT)
                    } else {
                        setLogs(prev => {
                            const existingIds = new Set(prev.map(l => l.id))
                            const unique = newLogs.filter((l: LogItem) => !existingIds.has(l.id))
                            if (unique.length === 0) return prev
                            return [...unique, ...prev]
                        })
                    }
                }
            }
        } catch (e) {
            console.error("Polling error", e)
        } finally {
            setLoading(false)
        }
    }, [serverId, userId, username, debouncedQuery, filter])

    // Load more logs (infinite scroll)
    const loadMoreLogs = useCallback(async () => {
        if (loadingMore || !hasMore) return

        setLoadingMore(true)

        try {
            const offset = logs.length
            const params = new URLSearchParams({
                serverId,
                type: filter,
                limit: String(LIMIT),
                offset: String(offset)
            })
            if (userId) params.set("userId", userId)
            if (username) params.set("username", username)
            if (debouncedQuery) params.set("query", debouncedQuery)

            const url = `/api/logs?${params.toString()}`
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                if (data.length > 0) {
                    setLogs(prev => {
                        // Filter just in case of overlaps
                        const existingIds = new Set(prev.map(l => l.id))
                        const unique = data.filter((l: LogItem) => !existingIds.has(l.id))
                        return [...prev, ...unique]
                    })
                    setHasMore(data.length >= LIMIT)
                } else {
                    setHasMore(false)
                }
            }
        } catch (e) {
            console.error("Load more error", e)
        } finally {
            setLoadingMore(false)
        }
    }, [serverId, userId, username, debouncedQuery, filter, logs.length, loadingMore, hasMore])

    // Initial fetch (first load only — no polling)
    useEffect(() => {
        fetchLogs(true)
    }, [fetchLogs])

    // Listen for new logs pushed via SSE (only available inside mod panel's ServerEventsProvider)
    const sseCtx = useServerEventsContextSafe()
    const sseNewLogs = sseCtx?.newLogs
    const lastSseLogId = useRef<string | null>(null)
    useEffect(() => {
        if (!sseNewLogs || sseNewLogs.length === 0) return
        const latestId = sseNewLogs[0]?.id
        if (latestId && latestId === lastSseLogId.current) return
        lastSseLogId.current = latestId || null

        // Don't inject SSE logs when user is searching — could confuse results
        if (debouncedQuery) return

        captureSnapshot()
        setLogs(prev => {
            const existingIds = new Set(prev.map(l => l.id))
            const unique = sseNewLogs.filter(l => !existingIds.has(l.id))
            if (unique.length === 0) return prev
            return [...unique, ...prev]
        })
    }, [sseNewLogs, debouncedQuery])

    // Scroll detection for infinite scroll
    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container
            // When scrolled to within 100px of the bottom, load more
            if (scrollHeight - scrollTop - clientHeight < 100) {
                loadMoreLogs()
            }
        }

        container.addEventListener("scroll", handleScroll)
        return () => container.removeEventListener("scroll", handleScroll)
    }, [loadMoreLogs])

    // Logs are now filtered server-side, no client-side filtering needed
    const filteredLogs = logs

    // Helper to create user link
    const UserLink = ({ name, className }: { name: string, className?: string }) => (
        <Link
            href={`/dashboard/${serverId}/user/${encodeURIComponent(name)}`}
            className={`font-semibold hover:underline cursor-pointer ${className || "text-white"}`}
        >
            {name}
        </Link>
    )

    // Permission check - AFTER all hooks, BEFORE render
    if (!permissions.canViewLogs) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-2 p-4">
                <Lock className="h-8 w-8 opacity-50" />
                <span className="text-sm font-medium">Access Denied</span>
                <span className="text-xs">You do not have permission to view logs.</span>
            </div>
        )
    }

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col gap-2 p-2 border-b border-[#2a2a2a]">
                <div className="flex gap-2">
                    {(["all", "join", "kill", "command"] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${filter === f
                                ? "bg-indigo-500 text-white"
                                : "bg-[#2a2a2a] text-zinc-400 hover:text-white"
                                }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search database..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full rounded bg-[#2a2a2a] px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 pr-8"
                    />
                    {query !== debouncedQuery && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                        </div>
                    )}
                </div>
            </div>

            <div className={compact ? "space-y-2 overflow-y-auto h-full p-2" : "rounded-xl border border-white/5 bg-zinc-900/50 backdrop-blur-sm flex-1 overflow-hidden"}>
                {loading && logs.length === 0 && !compact ? (
                    <div className="text-center text-zinc-500 py-8 flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading logs...
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center text-zinc-500 py-8">Waiting for logs...</div>
                ) : (
                    <div
                        ref={scrollContainerRef}
                        className="overflow-y-auto h-full p-2 space-y-2"
                    >
                        {filteredLogs.map((log, i) => (
                            <div key={`${log.id || i}-${log.timestamp}`} className={`flex items-start gap-3 rounded p-2 text-sm ${compact ? "bg-[#222] border-l-2 border-indigo-500" : "bg-white/5"}`}>
                                <div className="mt-0.5 text-zinc-500 flex-shrink-0">
                                    {log._type === "join" && log.Join !== false && <ScrollText className="h-4 w-4 text-emerald-400" />}
                                    {log._type === "join" && log.Join === false && <LogOut className="h-4 w-4 text-zinc-400" />}
                                    {log._type === "kill" && <Sword className="h-4 w-4 text-red-400" />}
                                    {log._type === "command" && <Terminal className="h-4 w-4 text-amber-400" />}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                    {/* Join/Leave logs */}
                                    {log._type === "join" && (
                                        <p className="break-words">
                                            <UserLink name={log.PlayerName || "Unknown"} className="text-emerald-400" />
                                            {log.Join === false ? " left the server." : " joined the server."}
                                        </p>
                                    )}

                                    {/* Kill logs - using parsed KillerName and VictimName */}
                                    {log._type === "kill" && (
                                        <p className="break-words">
                                            <UserLink name={log.KillerName || "Unknown"} className="text-red-400" />
                                            {" killed "}
                                            <UserLink name={log.VictimName || "Unknown"} />
                                        </p>
                                    )}

                                    {/* Command logs - fixed overflow */}
                                    {log._type === "command" && (
                                        <p className="break-words">
                                            <UserLink name={log.PlayerName || "Unknown"} className="text-amber-400" />
                                            {" used: "}
                                            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-zinc-300 break-all">
                                                {log.Command}{log.Arguments ? ` ${log.Arguments}` : ""}
                                            </code>
                                        </p>
                                    )}
                                </div>
                                <span className="ml-auto text-xs text-zinc-600 flex-shrink-0 whitespace-nowrap">
                                    {new Date((log.timestamp || log.Timestamp || 0) * 1000).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}

                        {/* Load more indicator */}
                        {loadingMore && (
                            <div className="flex items-center justify-center py-4 gap-2 text-zinc-500 text-sm">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading older logs...
                            </div>
                        )}

                        {!hasMore && logs.length > LIMIT && (
                            <div className="text-center py-4 text-zinc-600 text-xs">
                                No more logs to load
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
