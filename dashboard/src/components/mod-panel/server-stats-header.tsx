"use client"

import { useEffect, useState } from "react"

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

    // Auto-refresh every 10 seconds
    useEffect(() => {
        const refreshStats = async () => {
            try {
                const res = await fetch(`/api/server-stats?serverId=${serverId}`)
                if (res.ok) {
                    const data = await res.json()
                    setPlayers(data.players ?? 0)
                    setMaxPlayers(data.maxPlayers ?? 0)
                    setOnline(data.online ?? false)
                }
            } catch (e) {
                // Silent fail - keep current values
            }
        }

        const interval = setInterval(refreshStats, 10000)
        return () => clearInterval(interval)
    }, [serverId])

    const isServerOnline = online && players > 0

    return (
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div>
                <h3 className="font-bold text-white text-lg">{players} Players</h3>
                <p className="text-xs text-zinc-500">
                    {maxPlayers} Max • {isServerOnline ? "Online" : "Offline"}
                </p>
            </div>
            <div
                role="status"
                aria-label={isServerOnline ? "Server is online" : "Server is offline"}
                title={isServerOnline ? "Server is online" : "Server is offline"}
                className={`h-3 w-3 rounded-full ${isServerOnline ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-red-500"}`}
            />
        </div>
    )
}
