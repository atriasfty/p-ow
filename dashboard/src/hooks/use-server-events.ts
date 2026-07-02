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
    hasInitialData: boolean
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
    hasInitialData: false,
}

const MAX_BACKOFF = 30000
const BASE_BACKOFF = 1000
const STALE_THRESHOLD_MS = 15000
const STALE_CHECK_INTERVAL_MS = 3000

export function useServerEvents(serverId: string): ServerEventsState {
    const [state, setState] = useState<ServerEventsState>(DEFAULT_STATE)
    const esRef = useRef<EventSource | null>(null)
    const backoffRef = useRef(BASE_BACKOFF)
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const lastEventAtRef = useRef<number>(0)
    const mountedRef = useRef(true)

    const connect = useCallback(() => {
        if (!mountedRef.current) return

        // Clear any pending reconnect timer — prevents a stale timer from killing
        // a connection that was just established (e.g. by the visibilitychange handler).
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current)
            reconnectTimerRef.current = null
        }

        // Close any existing connection
        esRef.current?.close()

        const es = new EventSource(`/api/sse/${serverId}`)
        esRef.current = es

        const touch = () => { lastEventAtRef.current = Date.now() }

        es.onopen = () => {
            if (!mountedRef.current) return
            backoffRef.current = BASE_BACKOFF
            touch()
            setState(prev => ({ ...prev, connected: true, error: null }))
            // Fallback: unblock the desktop gate after 5s even if the game server
            // is offline and never sends players/server-stats events.
            setTimeout(() => {
                if (!mountedRef.current) return
                setState(prev => prev.hasInitialData ? prev : { ...prev, hasInitialData: true })
            }, 5000)
        }

        es.onerror = () => {
            if (!mountedRef.current) return
            es.close()
            setState(prev => ({ ...prev, connected: false, error: "Reconnecting..." }))

            // Exponential backoff reconnect — calculate next delay before scheduling
            // so the timer closure doesn't need to mutate backoffRef.
            const delay = backoffRef.current
            backoffRef.current = Math.min(delay * 2, MAX_BACKOFF)
            reconnectTimerRef.current = setTimeout(() => {
                reconnectTimerRef.current = null
                connect()
            }, delay)
        }

        // ---- Event handlers ----
        es.addEventListener("heartbeat", () => {
            if (!mountedRef.current) return
            touch()
            // Heartbeat fires even when game server is offline — use it to unblock
            // the desktop gate so the panel doesn't stay on skeleton indefinitely.
            setState(prev => ({
                ...prev,
                connected: true,
                error: null,
                hasInitialData: true,
            }))
        })

        es.addEventListener("players", (e) => {
            if (!mountedRef.current) return
            touch()
            const players: ParsedPlayerSSE[] = JSON.parse(e.data)
            setState(prev => ({ ...prev, players, hasInitialData: true }))
        })

        es.addEventListener("server-stats", (e) => {
            if (!mountedRef.current) return
            touch()
            const serverStats: ServerStatsSSE = JSON.parse(e.data)
            setState(prev => ({ ...prev, serverStats, hasInitialData: true }))
        })

        es.addEventListener("logs", (e) => {
            if (!mountedRef.current) return
            touch()
            const newLogs: LogSSE[] = JSON.parse(e.data)
            setState(prev => ({
                ...prev,
                newLogs: [...newLogs, ...prev.newLogs].slice(0, 200)
            }))
        })

        es.addEventListener("calls", (e) => {
            if (!mountedRef.current) return
            touch()
            const calls: CallsSSE = JSON.parse(e.data)
            setState(prev => ({ ...prev, calls }))
        })

        es.addEventListener("shift-status", (e) => {
            if (!mountedRef.current) return
            touch()
            const shiftStatus: ShiftStatusSSE = JSON.parse(e.data)
            setState(prev => ({ ...prev, shiftStatus }))
        })

        es.addEventListener("staff-on-duty-ids", (e) => {
            if (!mountedRef.current) return
            touch()
            const ids: string[] = JSON.parse(e.data)
            setState(prev => ({ ...prev, staffOnDutyIds: ids }))
        })

        es.addEventListener("staff-on-duty", (e) => {
            if (!mountedRef.current) return
            touch()
            const staff: StaffMemberSSE[] = JSON.parse(e.data)
            setState(prev => ({
                ...prev,
                staffOnDutyIds: staff.map(s => s.userId)
            }))
        })

        es.addEventListener("punishments", (e) => {
            if (!mountedRef.current) return
            touch()
            const event: PunishmentSSE = JSON.parse(e.data)
            setState(prev => ({
                ...prev,
                punishmentEvents: [event, ...prev.punishmentEvents].slice(0, 50)
            }))
        })

        es.addEventListener("ssd", (e) => {
            if (!mountedRef.current) return
            touch()
            const ssd: SsdSSE = JSON.parse(e.data)
            setState(prev => ({ ...prev, ssd }))
        })
    }, [serverId])

    // Reset all server-scoped state whenever serverId changes — otherwise stale
    // data from the previous server (logs, punishments, calls, shift status) keeps
    // showing, and some fields are appended to rather than replaced, so it would
    // actively mix with the new server's data instead of just lingering.
    useEffect(() => {
        setState(DEFAULT_STATE)
    }, [serverId])

    useEffect(() => {
        mountedRef.current = true
        connect()

        // Staleness check — show banner if no event received within threshold
        staleTimerRef.current = setInterval(() => {
            if (!mountedRef.current) return
            const sinceLastEvent = Date.now() - lastEventAtRef.current
            if (lastEventAtRef.current > 0 && sinceLastEvent > STALE_THRESHOLD_MS) {
                setState(prev => prev.connected ? { ...prev, connected: false, error: "Reconnecting..." } : prev)
            }
        }, STALE_CHECK_INTERVAL_MS)

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
            if (staleTimerRef.current) clearInterval(staleTimerRef.current)
            esRef.current?.close()
            esRef.current = null
            document.removeEventListener("visibilitychange", handleVisibilityChange)
        }
    }, [connect])

    return state
}
