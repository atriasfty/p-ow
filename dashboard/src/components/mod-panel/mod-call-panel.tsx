"use client"

import React, { useEffect, useState, useCallback, useRef } from "react"
import { X, MapPin, Users, ScrollText, Sword, Terminal, LogOut, Search, Loader2, User, Phone, Shield } from "lucide-react"
import Link from "next/link"

// ---- Types ----

interface ModCallContext {
    call: {
        id: string
        callerId: string
        callerName: string | null
        description: string | null
        callNumber: number | null
        positionX: number | null
        positionZ: number | null
        positionDescriptor: string | null
        respondingPlayers: string[]
        timestamp: number | null
        createdAt: string
    }
    nearbyPlayers: {
        userId: string
        playerName: string | null
        locationX: number
        locationZ: number
        postalCode: string | null
        streetName: string | null
    }[]
    currentPositions: {
        userId: string
        playerName: string | null
        locationX: number
        locationZ: number
        postalCode: string | null
        streetName: string | null
    }[]
    logs: {
        id: string
        _type: string
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
        createdAt?: string
    }[]
    involvedPlayerIds: string[]
}

const MAP_IMAGE = "/maps/fall_postals.png"
const MAP_RES = 3121

// ---- Component ----

export function ModCallPanel({
    serverId,
    callId,
    onClose
}: {
    serverId: string
    callId: string
    onClose: () => void
}) {
    const [data, setData] = useState<ModCallContext | null>(null)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<"all" | "kill" | "command" | "join">("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [isClosing, setIsClosing] = useState(false)

    const fetchContext = useCallback(async () => {
        try {
            const res = await fetch(`/api/modcall-context?serverId=${serverId}&callId=${callId}`)
            if (res.ok) {
                const ctx = await res.json()
                setData(ctx)
            }
        } catch (e) {
            console.error("Failed to fetch mod call context:", e)
        } finally {
            setLoading(false)
        }
    }, [serverId, callId])

    useEffect(() => {
        fetchContext()
    }, [fetchContext])

    const handleClose = () => {
        setIsClosing(true)
        setTimeout(onClose, 400) // match animation duration
    }

    // Filter logs
    const filteredLogs = data?.logs.filter(l => {
        if (filter !== "all" && l._type !== filter) return false
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            return (
                l.PlayerName?.toLowerCase().includes(q) ||
                l.KillerName?.toLowerCase().includes(q) ||
                l.VictimName?.toLowerCase().includes(q) ||
                l.Command?.toLowerCase().includes(q)
            )
        }
        return true
    }) ?? []

    const formatTime = (ts?: number | null, isoStr?: string) => {
        if (ts) return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        if (isoStr) return new Date(isoStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        return "–"
    }

    // All players to show on the mini-map: nearby + caller + responding mods  
    const mapPlayers = data?.currentPositions ?? []
    const callerOnMap = mapPlayers.find(p => p.userId === data?.call.callerId)

    const UserLink = ({ name, className }: { name: string, className?: string }) => (
        <Link
            href={`/dashboard/${serverId}/user/${encodeURIComponent(name)}`}
            className={`font-semibold hover:underline cursor-pointer ${className || "text-white"}`}
        >
            {name}
        </Link>
    )

    return (
        <>
            <div
                className="fixed inset-0 z-[200] bg-[#0d0d0d]"
                style={{
                    animation: isClosing
                        ? "diagonal-wipe-out 0.4s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards"
                        : "diagonal-wipe-in 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards"
                }}
            >
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative">
                                <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                                </div>
                                <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 animate-pulse" />
                            </div>
                            <p className="text-zinc-500 text-sm font-medium">Loading call context...</p>
                        </div>
                    </div>
                ) : !data ? (
                    <div className="h-full flex items-center justify-center text-zinc-500">
                        <p>Failed to load call data.</p>
                    </div>
                ) : (
                    <div className="h-full flex flex-col">
                        {/* ---- HEADER ---- */}
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-amber-500/5 to-transparent shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                    <Phone className="h-6 w-6 text-amber-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-xl font-black text-white tracking-tight">
                                            MOD CALL #{data.call.callNumber}
                                        </h2>
                                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest">
                                            Active
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
                                        <span>Caller: <span className="text-white font-medium">{data.call.callerName || data.call.callerId}</span></span>
                                        <span className="text-zinc-700">•</span>
                                        <MapPin className="h-3 w-3 inline" />
                                        <span>{data.call.positionDescriptor || "Unknown Location"}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                aria-label="Close active call"
                                title="Close call"
                                className="p-3 hover:bg-red-500/10 rounded-xl text-zinc-500 hover:text-red-400 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* ---- DESCRIPTION BANNER ---- */}
                        {data.call.description && (
                            <div className="px-6 py-3 bg-amber-500/5 border-b border-white/5 shrink-0">
                                <p className="text-sm text-amber-200/80 italic">&ldquo;{data.call.description}&rdquo;</p>
                            </div>
                        )}

                        {/* ---- MAIN CONTENT ---- */}
                        <div className="flex-1 flex min-h-0">
                            {/* ==== LEFT COLUMN (40%) ==== */}
                            <div className="w-[40%] border-r border-white/5 flex flex-col min-h-0">
                                {/* Mini Map */}
                                <div className="flex-1 relative overflow-hidden bg-[#050505]">
                                    <img
                                        src={MAP_IMAGE}
                                        alt="Map"
                                        className="w-full h-full object-cover opacity-80"
                                        draggable={false}
                                    />

                                    {/* Call position marker */}
                                    {data.call.positionX != null && data.call.positionZ != null && (
                                        <div
                                            className="absolute"
                                            style={{
                                                left: `${(data.call.positionX / MAP_RES) * 100}%`,
                                                top: `${(data.call.positionZ / MAP_RES) * 100}%`,
                                                transform: "translate(-50%, -50%)"
                                            }}
                                        >
                                            {/* Pulsing call marker */}
                                            <div className="relative">
                                                <div className="h-6 w-6 rounded-full bg-amber-500 border-2 border-white shadow-[0_0_20px_rgba(245,158,11,0.6)] z-10 relative flex items-center justify-center">
                                                    <Phone className="h-3 w-3 text-white" />
                                                </div>
                                                <div className="absolute inset-0 h-6 w-6 rounded-full bg-amber-500 animate-ping opacity-30" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Player dots on map */}
                                    {mapPlayers.map(player => (
                                        <div
                                            key={player.userId}
                                            className="absolute"
                                            style={{
                                                left: `${(player.locationX / MAP_RES) * 100}%`,
                                                top: `${(player.locationZ / MAP_RES) * 100}%`,
                                                transform: "translate(-50%, -50%)"
                                            }}
                                        >
                                            <div className="group relative">
                                                <div className={`h-3.5 w-3.5 rounded-full border-2 border-white shadow-lg z-10 relative ${player.userId === data.call.callerId
                                                        ? "bg-red-500 shadow-red-500/50"
                                                        : data.call.respondingPlayers.includes(player.userId)
                                                            ? "bg-blue-500 shadow-blue-500/50"
                                                            : "bg-zinc-400"
                                                    }`} />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-[10px] text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-white/10">
                                                    {player.playerName || player.userId}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Map overlay grid */}
                                    <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
                                </div>

                                {/* Involved Players List */}
                                <div className="h-[35%] border-t border-white/5 flex flex-col shrink-0">
                                    <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 shrink-0">
                                        <Users className="h-4 w-4 text-zinc-500" />
                                        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Involved Players</h3>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-zinc-500 font-bold ml-auto">
                                            {data.involvedPlayerIds.length}
                                        </span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                                        {/* Caller */}
                                        <Link
                                            href={`/dashboard/${serverId}/user/${encodeURIComponent(data.call.callerName || data.call.callerId)}`}
                                            className="flex items-center gap-3 p-2.5 rounded-xl bg-red-500/5 border border-red-500/10 hover:border-red-500/30 transition-all group"
                                        >
                                            <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                                                <User className="h-4 w-4 text-red-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-white truncate group-hover:text-red-400 transition-colors">
                                                    {data.call.callerName || data.call.callerId}
                                                </p>
                                                <p className="text-[10px] text-red-400/60 font-bold uppercase">Caller</p>
                                            </div>
                                        </Link>

                                        {/* Responding Moderators */}
                                        {data.call.respondingPlayers.map(modId => {
                                            const pos = data.currentPositions.find(p => p.userId === modId)
                                            return (
                                                <Link
                                                    key={modId}
                                                    href={`/dashboard/${serverId}/user/${encodeURIComponent(pos?.playerName || modId)}`}
                                                    className="flex items-center gap-3 p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:border-blue-500/30 transition-all group"
                                                >
                                                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                                        <Shield className="h-4 w-4 text-blue-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                                                            {pos?.playerName || modId}
                                                        </p>
                                                        <p className="text-[10px] text-blue-400/60 font-bold uppercase">Responding Mod</p>
                                                    </div>
                                                </Link>
                                            )
                                        })}

                                        {/* Nearby Players */}
                                        {data.nearbyPlayers
                                            .filter(p => p.userId !== data.call.callerId && !data.call.respondingPlayers.includes(p.userId))
                                            .map(player => (
                                                <Link
                                                    key={player.userId}
                                                    href={`/dashboard/${serverId}/user/${encodeURIComponent(player.playerName || player.userId)}`}
                                                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group"
                                                >
                                                    <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                                                        <User className="h-4 w-4 text-zinc-500" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-white truncate group-hover:text-zinc-300 transition-colors">
                                                            {player.playerName || player.userId}
                                                        </p>
                                                        <p className="text-[10px] text-zinc-600 font-medium">
                                                            {player.postalCode ? `[${player.postalCode}] ` : ""}{player.streetName || "Nearby Player"}
                                                        </p>
                                                    </div>
                                                </Link>
                                            ))
                                        }

                                        {data.nearbyPlayers.length === 0 && data.call.respondingPlayers.length === 0 && (
                                            <p className="text-xs text-zinc-600 text-center py-4">No other players nearby at time of call</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ==== RIGHT COLUMN (60%) — LOG VIEWER ==== */}
                            <div className="flex-1 flex flex-col min-h-0">
                                {/* Log Filter + Search */}
                                <div className="px-4 py-3 border-b border-white/5 flex flex-col gap-2 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <ScrollText className="h-4 w-4 text-zinc-500" />
                                        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Activity Logs</h3>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-zinc-500 font-bold ml-auto">
                                            {filteredLogs.length} entries
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(["all", "join", "kill", "command"] as const).map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setFilter(f)}
                                                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${filter === f
                                                        ? "bg-indigo-500 text-white"
                                                        : "bg-[#1a1a1a] text-zinc-400 hover:text-white"
                                                    }`}
                                            >
                                                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                                            </button>
                                        ))}
                                        <div className="flex-1 relative ml-2">
                                            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                placeholder="Search logs..."
                                                className="w-full rounded-lg bg-[#1a1a1a] pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Log Entries */}
                                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                                    {filteredLogs.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                                            No logs found for involved players
                                        </div>
                                    ) : (
                                        filteredLogs.map((log, i) => (
                                            <div
                                                key={`${log.id}-${i}`}
                                                className="flex items-start gap-3 rounded-xl p-3 text-sm bg-white/[0.02] hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/5"
                                            >
                                                <div className="mt-0.5 text-zinc-500 flex-shrink-0">
                                                    {log._type === "join" && log.Join !== false && <LogOut className="h-4 w-4 text-emerald-400 rotate-180" />}
                                                    {log._type === "join" && log.Join === false && <LogOut className="h-4 w-4 text-zinc-400" />}
                                                    {log._type === "kill" && <Sword className="h-4 w-4 text-red-400" />}
                                                    {log._type === "command" && <Terminal className="h-4 w-4 text-amber-400" />}
                                                </div>
                                                <div className="flex-1 min-w-0 space-y-0.5">
                                                    {log._type === "join" && (
                                                        <p className="break-words text-xs">
                                                            <UserLink name={log.PlayerName || "Unknown"} className="text-emerald-400" />
                                                            {log.Join === false ? " left the server." : " joined the server."}
                                                        </p>
                                                    )}
                                                    {log._type === "kill" && (
                                                        <p className="break-words text-xs">
                                                            <UserLink name={log.KillerName || "Unknown"} className="text-red-400" />
                                                            {" killed "}
                                                            <UserLink name={log.VictimName || "Unknown"} />
                                                        </p>
                                                    )}
                                                    {log._type === "command" && (
                                                        <p className="break-words text-xs">
                                                            <UserLink name={log.PlayerName || "Unknown"} className="text-amber-400" />
                                                            {" used: "}
                                                            <code className="rounded bg-black/30 px-1.5 py-0.5 text-[11px] text-zinc-300 break-all">
                                                                {log.Command}{log.Arguments ? ` ${log.Arguments}` : ""}
                                                            </code>
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="ml-auto text-[10px] text-zinc-600 flex-shrink-0 whitespace-nowrap font-mono">
                                                    {formatTime(log.timestamp, log.createdAt)}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ---- FOOTER LEGEND ---- */}
                        <div className="px-6 py-3 border-t border-white/5 bg-[#0a0a0a] flex items-center gap-6 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Call Location</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Caller</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Responding Mod</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-zinc-400" />
                                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Nearby Player</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
