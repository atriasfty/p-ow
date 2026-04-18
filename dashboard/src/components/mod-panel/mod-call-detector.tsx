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
    const [seenCalls, setSeenCalls] = useState<Record<string, number>>({}) // ID -> timestamp

    const runCleanup = (currentData: Record<string, number>) => {
        const now = Date.now()
        const ONE_DAY_MS = 24 * 60 * 60 * 1000
        const entries = Object.entries(currentData)
        const filtered = entries.filter(([_, timestamp]) => (now - timestamp) < ONE_DAY_MS)

        if (entries.length !== filtered.length) {
            const next = Object.fromEntries(filtered)
            setSeenCalls(next)
            try {
                sessionStorage.setItem("seen_mod_calls_v2", JSON.stringify(next))
            } catch { }
            return next
        }
        return currentData
    }

    // Load from session storage & setup hourly cleanup
    useEffect(() => {
        let current: Record<string, number> = {}
        try {
            const saved = sessionStorage.getItem("seen_mod_calls_v2")
            if (saved) {
                current = JSON.parse(saved)
            }
        } catch { }
        
        const cleaned = runCleanup(current)
        setSeenCalls(cleaned)

        const interval = setInterval(() => {
            setSeenCalls(prev => runCleanup(prev))
        }, 60 * 60 * 1000) // Every hour

        return () => clearInterval(interval)
    }, [])

    const markAsSeen = (id: string) => {
        setSeenCalls(prev => {
            const next = { ...prev, [id]: Date.now() }
            try {
                sessionStorage.setItem("seen_mod_calls_v2", JSON.stringify(next))
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
            if (seenCalls[call.id]) continue

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
    }, [calls, userRobloxId, seenCalls])

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
