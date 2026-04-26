"use client"

import { useEffect, useState } from "react"
import { useServerEventsContext } from "@/components/providers/server-events-provider"

interface ServerStatsProps {
    serverId: string
    initialPlayers: number
    initialMaxPlayers: number
    initialOnline: boolean
}

export function ServerStatsHeader({ serverId, initialPlayers, initialMaxPlayers, initialOnline }: ServerStatsProps) {
    const [players, setPlayers] = useState(initialPlayers)
    const [maxPlayers, setMaxPlayers] = useState(initialMaxPlayers)
    const [online, setOnline] = useState(initialOnline)

    const { serverStats, players: ssePlayers } = useServerEventsContext()

    // Update from SSE server-stats events
    useEffect(() => {
        if (serverStats) {
            setPlayers(serverStats.players)
            if (serverStats.maxPlayers > 0) setMaxPlayers(serverStats.maxPlayers)
            setOnline(serverStats.online)
        }
    }, [serverStats])

    // Also update player count from the players list itself (more accurate)
    useEffect(() => {
        if (ssePlayers.length > 0) {
            setPlayers(ssePlayers.length)
        }
    }, [ssePlayers])

    const isServerOnline = online && players > 0

    return (
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div>
                <h3 className="font-bold text-white text-lg">{players} Players</h3>
                <p className="text-xs text-zinc-500">
                    {maxPlayers > 0 ? `${maxPlayers} Max • ` : ""}{isServerOnline ? "Online" : "Offline"}
                </p>
            </div>
            <div className={`h-3 w-3 rounded-full ${isServerOnline ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-red-500"}`}></div>
        </div>
    )
}
