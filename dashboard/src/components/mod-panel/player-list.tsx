
"use client"

import { useEffect, useState } from "react"
import { User, Loader2, Shield, Star, Truck } from "lucide-react"
import Link from "next/link"

export interface ParsedPlayer {
    name: string
    id: string
    team?: string
    permission?: string | number
    avatar?: string
    vehicle?: string
    callsign?: string
    location?: {
        x: number
        z: number
        postal: string | null
        street: string | null
        building: string | null
    } | null
}

export function PlayerList({ serverId, players: externalPlayers }: { serverId: string, players?: ParsedPlayer[] }) {
    const [players, setPlayers] = useState<ParsedPlayer[]>(externalPlayers || [])
    const [loading, setLoading] = useState(!externalPlayers)
    const [error, setError] = useState("")
    const [showAll, setShowAll] = useState(false)

    // Update internal state when external players change
    useEffect(() => {
        if (externalPlayers) {
            setPlayers(externalPlayers)
            setLoading(false)
        }
    }, [externalPlayers])

    // Only fetch if no external players provided (standalone mode)
    useEffect(() => {
        // Skip polling if external players are provided (parent handles it)
        if (externalPlayers) return

        const fetchPlayers = async () => {
            try {
                const res = await fetch(`/api/players?serverId=${serverId}`)
                if (res.ok) {
                    const data = await res.json()
                    setPlayers(data)
                    setError("")
                } else {
                    setError("Failed to load")
                }
            } catch (e) {
                setError("Error loading players")
            } finally {
                setLoading(false)
            }
        }

        fetchPlayers()
        const interval = setInterval(fetchPlayers, 10000)
        return () => clearInterval(interval)
    }, [serverId, externalPlayers])

    const getTeamIcon = (team?: string) => {
        if (!team) return null
        const t = team.toLowerCase()
        if (t.includes("sheriff") || t.includes("so")) return <Star className="h-3 w-3 text-amber-400 fill-amber-400/20" />
        if (t.includes("police") || t.includes("pd") || t.includes("trooper")) return <Shield className="h-3 w-3 text-blue-400 fill-blue-400/20" />
        if (t.includes("dot") || t.includes("tow") || t.includes("transport")) return <Truck className="h-3 w-3 text-orange-400" />
        return null
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-xs">Loading players...</span>
            </div>
        )
    }

    if (error && !externalPlayers) {
        return <div className="text-center text-xs text-red-400 py-2">{error}</div>
    }

    if (players.length === 0) {
        return <div className="text-center text-xs text-zinc-500 h-full flex items-center justify-center">No players online</div>
    }

    // Basic "virtualization" strategy: limit visible items if list is massive
    // and use CSS content-visibility for rendering performance.
    const DISPLAY_LIMIT = 50
    const displayedPlayers = (players.length > DISPLAY_LIMIT && !showAll)
        ? players.slice(0, DISPLAY_LIMIT)
        : players

    return (
        <div className="space-y-1 h-full overflow-y-auto pr-1 custom-scrollbar">
            {displayedPlayers.map((player, i) => (
                <Link
                    key={player.id || i}
                    href={`/dashboard/${serverId}/user/${encodeURIComponent(player.name)}`}
                    className="flex items-center gap-2 p-2 rounded-lg bg-[#222] hover:bg-[#2a2a2a] transition-colors group relative"
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' } as any}
                >
                    <div className="relative">
                        <div className="h-8 w-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {player.avatar ? (
                                <img src={player.avatar} alt={player.name} className="h-full w-full object-cover" />
                            ) : (
                                <User className="h-4 w-4 text-zinc-400" />
                            )}
                        </div>

                        {/* Team Icon Badge */}
                        {getTeamIcon(player.team) && (
                            <div className="absolute -bottom-1 -right-1 bg-[#222] rounded-full p-0.5 border border-[#333] z-10">
                                {getTeamIcon(player.team)}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 relative">
                            {/* Callsign Badge */}
                            {player.callsign && (
                                <span className="text-[10px] font-bold px-1 rounded bg-zinc-700 text-zinc-300">
                                    {player.callsign}
                                </span>
                            )}
                            <p className="text-sm font-medium text-white truncate group-hover:text-indigo-400 transition-colors">
                                {player.name}
                            </p>
                        </div>
                        <p className="text-[10px] text-zinc-500 truncate flex items-center gap-1">
                            {player.location?.postal && (
                                <span className="text-sky-400 font-bold">[{player.location.postal}]</span>
                            )}
                            {player.location?.street && (
                                <span className="text-zinc-400">{player.location.street}</span>
                            )}
                            {!player.location?.street && (
                                player.vehicle && player.vehicle !== "Unknown" && player.vehicle !== "None" && player.vehicle.trim() !== "" ? (
                                    <span className="text-zinc-400">{player.vehicle}</span>
                                ) : (
                                    player.team || "Civilian"
                                )
                            )}
                        </p>
                    </div>
                </Link>
            ))}

            {!showAll && players.length > DISPLAY_LIMIT && (
                <button
                    onClick={() => setShowAll(true)}
                    className="w-full py-2 text-[10px] text-zinc-500 hover:text-white transition-colors border border-dashed border-zinc-800 rounded-lg mt-2 font-mono uppercase tracking-widest"
                >
                    + {players.length - DISPLAY_LIMIT} more players offline/hidden
                </button>
            )}
        </div>
    )
}
