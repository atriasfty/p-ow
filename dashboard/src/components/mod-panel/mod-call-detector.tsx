"use client"

import { useEffect, useState, useRef } from "react"
import { useServerEventsContext } from "@/components/providers/server-events-provider"
import { ModCallPanel } from "./mod-call-panel"

interface ModCallDetectorProps {
    serverId: string
    userRobloxId?: string | null
}

/**
 * Watches SSE `calls` events for mod calls where the current user's
 * Roblox ID appears in the respondingPlayers array. When detected,
 * auto-opens the ModCallPanel.
 * Also allows manual trigger via static setter.
 */
export function ModCallDetector({ serverId, userRobloxId }: ModCallDetectorProps) {
    const { calls } = useServerEventsContext()
    const [activePanelCallId, setActivePanelCallId] = useState<string | null>(null)
    const [seenCallIds, setSeenCallIds] = useState<Set<string>>(new Set())

    // Load from session storage roughly
    useEffect(() => {
        try {
            const saved = sessionStorage.getItem("seen_mod_calls")
            if (saved) {
                const parsed = JSON.parse(saved)
                setSeenCallIds(new Set(parsed))
            }
        } catch { }
    }, [])

    const markAsSeen = (id: string) => {
        setSeenCallIds(prev => {
            const next = new Set(prev)
            next.add(id)
            try {
                sessionStorage.setItem("seen_mod_calls", JSON.stringify(Array.from(next)))
            } catch { }
            return next
        })
    }

    // Open manually (e.g., from the calls modal)
    // Expose via a module-level setter
    useEffect(() => {
        ModCallDetector.openPanel = (callId: string) => setActivePanelCallId(callId)
        return () => { ModCallDetector.openPanel = () => { } }
    }, [])

    // Auto-detect when the user has responded to a mod call
    useEffect(() => {
        if (!calls?.modCalls || !userRobloxId) return

        for (const call of calls.modCalls) {
            if (seenCallIds.has(call.id)) continue

            // Parse respondingPlayers if it's a JSON string
            let responders: string[] = []
            if (typeof call.respondingPlayers === "string") {
                try {
                    responders = JSON.parse(call.respondingPlayers)
                } catch { continue }
            } else if (Array.isArray(call.respondingPlayers)) {
                responders = call.respondingPlayers.map(String)
            }

            if (responders.includes(userRobloxId)) {
                markAsSeen(call.id)
                setActivePanelCallId(call.id)
                break // only open one at a time
            }
        }
    }, [calls, userRobloxId, seenCallIds])

    if (!activePanelCallId) return null

    return (
        <ModCallPanel
            serverId={serverId}
            callId={activePanelCallId}
            onClose={() => setActivePanelCallId(null)}
        />
    )
}

// Static method so other components (CallsModal) can trigger the panel
ModCallDetector.openPanel = (_callId: string) => { }
