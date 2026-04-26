"use client"

import { useEffect, useRef, useState } from "react"
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
 *
 * Does NOT trigger when running as an installed PWA (standalone display-mode)
 * because mobile operators use the app and the full-screen takeover is disruptive.
 */
export function ModCallDetector({ serverId, userRobloxId }: ModCallDetectorProps) {
    const { calls } = useServerEventsContext()
    const [activePanelCallId, setActivePanelCallId] = useState<string | null>(null)

    // Track seen calls in a ref so the auto-trigger effect doesn't need it as a
    // dependency — avoids stale-closure bugs and unnecessary re-runs when the
    // seen set changes.
    const seenRef = useRef<Record<string, number>>({})

    // Detect standalone PWA once on mount — checking every render is unnecessary
    // and matchMedia isn't available server-side.
    const isPwaRef = useRef(false)
    useEffect(() => {
        isPwaRef.current =
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as any).standalone === true
    }, [])

    // Persist seen calls across page navigations within the same session.
    useEffect(() => {
        try {
            const saved = sessionStorage.getItem("seen_mod_calls_v2")
            if (saved) seenRef.current = JSON.parse(saved)
        } catch { }

        // Evict entries older than 24 h every hour so the set doesn't grow forever.
        const evict = () => {
            const now = Date.now()
            const ONE_DAY = 24 * 60 * 60 * 1000
            const next: Record<string, number> = {}
            for (const [id, ts] of Object.entries(seenRef.current)) {
                if (now - ts < ONE_DAY) next[id] = ts
            }
            seenRef.current = next
            try { sessionStorage.setItem("seen_mod_calls_v2", JSON.stringify(next)) } catch { }
        }

        const interval = setInterval(evict, 60 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    // Expose a static setter so CallsModal can open the panel manually.
    useEffect(() => {
        ModCallDetector.openPanel = (callId: string) => setActivePanelCallId(callId)
        return () => { ModCallDetector.openPanel = () => { } }
    }, [])

    // Auto-detect when this user has been assigned to a mod call.
    // Intentionally excludes `seenRef` from deps — it's a ref, always current.
    useEffect(() => {
        if (!calls?.modCalls || !userRobloxId) return
        if (isPwaRef.current) return  // suppress on installed PWA / mobile app

        const myId = String(userRobloxId)

        for (const call of calls.modCalls) {
            if (seenRef.current[call.id]) continue

            let responders: string[] = []
            if (typeof call.respondingPlayers === "string") {
                try { responders = JSON.parse(call.respondingPlayers) } catch { continue }
            } else if (Array.isArray(call.respondingPlayers)) {
                responders = call.respondingPlayers
            }

            if (responders.map(String).includes(myId)) {
                // Mark seen before setting state to prevent a double-open if the
                // effect fires again before the state update is committed.
                seenRef.current = { ...seenRef.current, [call.id]: Date.now() }
                try {
                    sessionStorage.setItem("seen_mod_calls_v2", JSON.stringify(seenRef.current))
                } catch { }

                setActivePanelCallId(call.id)
                break // only open one at a time
            }
        }
    }, [calls, userRobloxId])

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
