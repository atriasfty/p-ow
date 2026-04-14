"use client"

import { createContext, useContext, ReactNode } from "react"
import {
    useServerEvents,
    ServerEventsState,
    ParsedPlayerSSE,
    ServerStatsSSE,
    LogSSE,
    CallsSSE,
    ShiftStatusSSE,
    StaffMemberSSE,
    PunishmentSSE,
    SsdSSE,
} from "@/hooks/use-server-events"

// Re-export types for convenience
export type {
    ParsedPlayerSSE,
    ServerStatsSSE,
    LogSSE,
    CallsSSE,
    ShiftStatusSSE,
    StaffMemberSSE,
    PunishmentSSE,
    SsdSSE,
}

const ServerEventsContext = createContext<ServerEventsState | null>(null)

export function ServerEventsProvider({
    serverId,
    children,
}: {
    serverId: string
    children: ReactNode
}) {
    const state = useServerEvents(serverId)
    return (
        <ServerEventsContext.Provider value={state}>
            {children}
        </ServerEventsContext.Provider>
    )
}

/**
 * Consume the SSE state from anywhere inside the mod panel.
 * Must be used inside <ServerEventsProvider>.
 */
export function useServerEventsContext(): ServerEventsState {
    const ctx = useContext(ServerEventsContext)
    if (!ctx) {
        throw new Error("useServerEventsContext must be used inside <ServerEventsProvider>")
    }
    return ctx
}

/**
 * Safe version that returns null when used outside <ServerEventsProvider>.
 * Use this in components that can be rendered both inside and outside the provider.
 */
export function useServerEventsContextSafe(): ServerEventsState | null {
    return useContext(ServerEventsContext)
}
