
"use client"

import { useState, useEffect } from "react"
import { PlayerList } from "./player-list"
import { PlayerSearch } from "./player-search"
import { useServerEventsContext } from "@/components/providers/server-events-provider"
import type { ParsedPlayerSSE } from "@/components/providers/server-events-provider"

export function PlayerManager({ serverId }: { serverId: string }) {
    const { players: ssePlayers } = useServerEventsContext()
    const [players, setPlayers] = useState<ParsedPlayerSSE[]>([])

    // Update from SSE live players list
    useEffect(() => {
        setPlayers(ssePlayers)
    }, [ssePlayers])

    return (
        <>
            <div className="relative flex-shrink-0">
                <PlayerSearch serverId={serverId} onlinePlayers={players} />
            </div>
            <div className="flex-1 overflow-hidden mt-3">
                <PlayerList serverId={serverId} players={players} />
            </div>
        </>
    )
}
