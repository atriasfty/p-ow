"use client"

import { useEffect, useRef, useState, useCallback } from "react"

// ---- Types matching the server's ServerEventMap ----

export type ParsedPlayerSSE = {
    name: string
    id: string
    team?: string
    permission?: number | string
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

export type ServerStatsSSE = {
    players: number
    maxPlayers: number
    online: boolean
}

export type LogSSE = {
    id: string
    _type: string
    [key: string]: any
}

export type CallsSSE = {
    modCalls: any[]
    emergencyCalls: any[]
}

export type ShiftStatusSSE = {
    shift: { id: string; startTime: string } | null
}

export type StaffMemberSSE = {
    userId: string
    name: string
    username: string
    robloxUsername: string
    imageUrl: string
    shiftStart: string
}

export type PunishmentSSE = {
    action: "created" | "updated" | "deleted"
    punishment: any
}

export type SsdSSE = {
    ssd: { timestamp: string; initiatedBy: string; shiftsEnded: number } | null
}

export type ServerEventsState = {
    players: ParsedPlayerSSE[]
    serverStats: ServerStatsSSE | null
    newLogs: LogSSE[]
    calls: CallsSSE | null
    shiftStatus: ShiftStatusSSE | null
    staffOnDutyIds: string[]
    punishmentEvents: PunishmentSSE[]
    ssd: SsdSSE | null
    connected: boolean
    error: string | null
}

const DEFAULT_STATE: ServerEventsState = {
    players: [],
    serverStats: null,
    newLogs: [],
    calls: null,
    shiftStatus: null,
    staffOnDutyIds: [],
    punishmentEvents: [],
    ssd: null,
    connected: false,
    error: null,
}

const MAX_BACKOFF = 30000
const BASE_BACKOFF = 1000

export function useServerEvents(serverId: string): ServerEventsState {
    const [state, setState] = useState<ServerEventsState>(DEFAULT_STATE)
    const esRef = useRef<EventSource | null>(null)
    const backoffRef = useRef(BASE_BACKOFF)
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const mountedRef = useRef(true)

    const connect = useCallback(() => {
        if (!mountedRef.current) return

        // Close any existing connection
        esRef.current?.close()

        const es = new EventSource(`/api/sse/${serverId}`)
        esRef.current = es

        es.onopen = () => {
            if (!mountedRef.current) return
            backoffRef.current = BASE_BACKOFF
            setState(prev => ({ ...prev, connected: true, error: null }))
        }

        es.onerror = () => {
            if (!mountedRef.current) return
            es.close()
            setState(prev => ({ ...prev, connected: false, error: "Reconnecting..." }))

            // Exponential backoff reconnect
            reconnectTimerRef.current = setTimeout(() => {
                backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF)
                connect()
            }, backoffRef.current)
        }

        // ---- Event handlers ----
        es.addEventListener("players", (e) => {
            if (!mountedRef.current) return
            const players: ParsedPlayerSSE[] = JSON.parse(e.data)
            setState(prev => ({ ...prev, players }))
        })

        es.addEventListener("server-stats", (e) => {
            if (!mountedRef.current) return
            const serverStats: ServerStatsSSE = JSON.parse(e.data)
            setState(prev => ({ ...prev, serverStats }))
        })

        es.addEventListener("logs", (e) => {
            if (!mountedRef.current) return
            const newLogs: LogSSE[] = JSON.parse(e.data)
            // Accumulate new logs; components will prepend them
            setState(prev => ({
                ...prev,
                newLogs: [...newLogs, ...prev.newLogs].slice(0, 200)
            }))
        })

        es.addEventListener("calls", (e) => {
            if (!mountedRef.current) return
            const calls: CallsSSE = JSON.parse(e.data)
            setState(prev => ({ ...prev, calls }))
        })

        es.addEventListener("shift-status", (e) => {
            if (!mountedRef.current) return
            const shiftStatus: ShiftStatusSSE = JSON.parse(e.data)
            setState(prev => ({ ...prev, shiftStatus }))
        })

        es.addEventListener("staff-on-duty-ids", (e) => {
            if (!mountedRef.current) return
            const ids: string[] = JSON.parse(e.data)
            setState(prev => ({ ...prev, staffOnDutyIds: ids }))
        })

        es.addEventListener("staff-on-duty", (e) => {
            if (!mountedRef.current) return
            const staff: StaffMemberSSE[] = JSON.parse(e.data)
            setState(prev => ({
                ...prev,
                staffOnDutyIds: staff.map(s => s.userId)
            }))
        })

        es.addEventListener("punishments", (e) => {
            if (!mountedRef.current) return
            const event: PunishmentSSE = JSON.parse(e.data)
            setState(prev => ({
                ...prev,
                punishmentEvents: [event, ...prev.punishmentEvents].slice(0, 50)
            }))
        })

        es.addEventListener("ssd", (e) => {
            if (!mountedRef.current) return
            const ssd: SsdSSE = JSON.parse(e.data)
            setState(prev => ({ ...prev, ssd }))
        })
    }, [serverId])

    useEffect(() => {
        mountedRef.current = true
        connect()

        // Reconnect when tab becomes visible again
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                if (!esRef.current || esRef.current.readyState === EventSource.CLOSED) {
                    connect()
                }
            }
        }
        document.addEventListener("visibilitychange", handleVisibilityChange)

        return () => {
            mountedRef.current = false
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
            esRef.current?.close()
            esRef.current = null
            document.removeEventListener("visibilitychange", handleVisibilityChange)
        }
    }, [connect])

    return state
}
