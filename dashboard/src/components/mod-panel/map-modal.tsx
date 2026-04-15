
"use client"

import React, { useEffect, useState } from "react"
import { X, User, Map as MapIcon, Loader2, ZoomIn, ZoomOut, Search } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { ParsedPlayer } from "./player-list"

interface MapModalProps {
    serverId: string
    onClose: () => void
}

const MAP_IMAGE = "/maps/fall_postals.png"

// PRC Map Resolution (Official fall_postals.png)
const MAP_RES = 3121

export function MapModal({ serverId, onClose }: MapModalProps) {
    const [players, setPlayers] = useState<ParsedPlayer[]>([])
    const [loading, setLoading] = useState(true)
    const [zoom, setZoom] = useState(1)
    const [searchTerm, setSearchTerm] = useState("")
    const router = useRouter()
    const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null)

    // Polling logic - only when open
    useEffect(() => {
        const fetchPlayers = async () => {
            try {
                const res = await fetch(`/api/players?serverId=${serverId}`)
                if (res.ok) {
                    const data = await res.json()
                    // Filter players with location only for map
                    setPlayers(data.filter((p: ParsedPlayer) => p.location))
                }
            } catch (e) {
                console.error("Map player fetch error:", e)
            } finally {
                setLoading(false)
            }
        }

        fetchPlayers()
        const interval = setInterval(fetchPlayers, 5000)
        return () => clearInterval(interval)
    }, [serverId])

    const getTeamColor = (team?: string) => {
        if (!team) return "bg-zinc-400"
        const t = team.toLowerCase()
        if (t.includes("police") || t.includes("pd") || t.includes("trooper")) return "bg-blue-500 shadow-blue-500/50"
        if (t.includes("sheriff") || t.includes("so")) return "bg-emerald-500 shadow-emerald-500/50"
        if (t.includes("red") || t.includes("ems") || t.includes("fire") || t.includes("medical")) return "bg-red-500 shadow-red-500/50"
        if (t.includes("green") || t.includes("dot") || t.includes("tow")) return "bg-green-400 shadow-green-400/50"
        return "bg-zinc-400"
    }

    const filteredPlayers = players.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.location?.postal?.includes(searchTerm)
    )

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 lg:p-8"
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full h-full max-w-7xl bg-[#0a0a0a] rounded-3xl border border-white/5 overflow-hidden flex flex-col shadow-2xl relative"
            >
                {/* Header */}
                <div className="p-4 lg:p-6 border-b border-white/5 flex items-center justify-between bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                            <MapIcon className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Live Player Map</h2>
                            <p className="text-xs text-zinc-500 flex items-center gap-2">
                                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {players.length} Players Tracked
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#111] border border-white/5 rounded-xl text-zinc-400 focus-within:border-indigo-500/50 transition-all">
                            <Search className="h-4 w-4" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search player/postal..."
                                className="bg-transparent border-none focus:ring-0 text-xs text-white placeholder-zinc-600 w-48"
                            />
                        </div>

                        {/* Zoom Controls */}
                        <div className="flex items-center gap-1 bg-[#111] p-1 rounded-xl border border-white/5">
                            <button
                                onClick={() => setZoom(Math.max(1, zoom - 0.5))}
                                className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-all shadow-glow-hover"
                            >
                                <ZoomOut className="h-4 w-4" />
                            </button>
                            <span className="text-[10px] font-mono w-10 text-center text-zinc-500">{Math.round(zoom * 100)}%</span>
                            <button
                                onClick={() => setZoom(Math.min(4, zoom + 0.5))}
                                className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-all shadow-glow-hover"
                            >
                                <ZoomIn className="h-4 w-4" />
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            aria-label="Close map modal"
                            className="p-3 hover:bg-red-500/10 rounded-xl text-zinc-400 hover:text-red-400 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                {/* Map Area */}
                <div className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing bg-[#050505]">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0a0a0a]/40 backdrop-blur-sm">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                                <span className="text-zinc-500 text-sm font-medium">Initializing Map...</span>
                            </div>
                        </div>
                    )}

                    <div
                        className="w-full h-full overflow-auto custom-scrollbar scroll-smooth p-64"
                        style={{ perspective: '1000px' }}
                    >
                        <div
                            className="relative shadow-2xl transition-transform duration-500 ease-out"
                            style={{
                                width: `${zoom * 100}%`,
                                height: 'auto',
                                aspectRatio: '1 / 1'
                            }}
                        >
                            {/* The Map Image */}
                            <img
                                src={MAP_IMAGE}
                                alt="ER:LC Map"
                                className="w-full h-full object-contain rounded-xl select-none"
                                draggable={false}
                            />

                            {/* Grid/Scanning Overlay */}
                            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />

                            {/* Player Dots */}
                            <AnimatePresence initial={false}>
                                {filteredPlayers.map((player) => {
                                    if (!player.location) return null

                                    const xPct = (player.location.x / MAP_RES) * 100
                                    const zPct = (player.location.z / MAP_RES) * 100

                                    return (
                                        <motion.div
                                            key={player.id}
                                            initial={false}
                                            animate={{
                                                opacity: 1,
                                                scale: 1,
                                                left: `${xPct}%`,
                                                top: `${zPct}%`
                                            }}
                                            transition={{
                                                top: { duration: 4.8, ease: "linear" },
                                                left: { duration: 4.8, ease: "linear" },
                                                scale: { duration: 0.3 }
                                            }}
                                            className="absolute"
                                            style={{ transform: 'translate(-50%, -50%)' }}
                                        >
                                            <div
                                                className="relative group cursor-pointer"
                                                onMouseEnter={() => setHoveredPlayerId(player.id)}
                                                onMouseLeave={() => setHoveredPlayerId(null)}
                                                onClick={() => router.push(`/dashboard/${serverId}/user/${encodeURIComponent(player.name)}`)}
                                            >
                                                {/* Player Indicator */}
                                                <div className={`h-4 w-4 rounded-full border-2 border-white shadow-xl transition-all duration-300 group-hover:scale-150 z-10 relative ${getTeamColor(player.team)}`} />

                                                {/* Tooltip */}
                                                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-48 bg-[#1a1a1a] border border-white/10 rounded-2xl p-3 shadow-2xl transition-all duration-200 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 z-[60]`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                                                            {player.avatar ? (
                                                                <img src={player.avatar} alt={player.name} className="h-full w-full object-cover" />
                                                            ) : (
                                                                <User className="h-5 w-5 text-zinc-500" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-white truncate">{player.name}</p>
                                                            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{player.team || "Civilian"}</p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5 overflow-hidden">
                                                            <span className="text-[10px] font-bold text-sky-400">[{player.location.postal || "???"}]</span>
                                                            <span className="text-[10px] text-zinc-500 truncate">{player.location.street || "Unknown St"}</span>
                                                        </div>
                                                        <p className="text-[10px] text-zinc-600 shrink-0 ml-1">Live</p>
                                                    </div>
                                                </div>

                                                {/* Ping Effect for hovered player */}
                                                <AnimatePresence>
                                                    {hoveredPlayerId === player.id && (
                                                        <motion.div
                                                            initial={{ scale: 0.5, opacity: 0 }}
                                                            animate={{ scale: 3, opacity: 0.2 }}
                                                            exit={{ opacity: 0 }}
                                                            transition={{ repeat: Infinity, duration: 1.5 }}
                                                            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full ${getTeamColor(player.team)}`}
                                                        />
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Legend/Footer */}
                <div className="px-6 py-4 border-t border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-zinc-400 shadow-[0_0_8px_rgba(161,161,170,0.5)]" />
                            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Civilian</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">LEO</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Sheriff</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">EMS/FIRE</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">DOT</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}
