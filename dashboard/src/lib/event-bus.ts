import { EventEmitter } from "events"
import { createLogger } from "./logger"

const log = createLogger("event-bus")

// ---- Types ----

export type ParsedPlayer = {
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

export type ServerStatsPayload = {
    players: number
    maxPlayers: number
    online: boolean
}

export type LogPayload = {
    id: string
    _type: string
    [key: string]: any
}

export type CallsPayload = {
    modCalls: any[]
    emergencyCalls: any[]
}

export type ShiftStatusPayload = {
    shift: { id: string; startTime: string } | null
}

export type StaffMemberPayload = {
    userId: string
    name: string
    username: string
    robloxUsername: string
    imageUrl: string
    shiftStart: string
}

export type PunishmentPayload = {
    action: "created" | "updated" | "deleted"
    punishment: any
}

export type SsdPayload = {
    ssd: { timestamp: string; initiatedBy: string; shiftsEnded: number } | null
}

export type PlayerStatusPayload = {
    playerId: string
    online: boolean
    team?: string
    vehicle?: string | null
    callsign?: string | null
    permission?: number | string
}

export type ServerEventMap = {
    players: ParsedPlayer[]
    "server-stats": ServerStatsPayload
    logs: LogPayload[]
    calls: CallsPayload
    "shift-status": ShiftStatusPayload
    "staff-on-duty": StaffMemberPayload[]
    "staff-on-duty-ids": string[]
    punishments: PunishmentPayload
    ssd: SsdPayload
    "player-status": PlayerStatusPayload
}

export type ServerEventType = keyof ServerEventMap

type Listener = (type: ServerEventType, data: ServerEventMap[ServerEventType]) => void

// ---- EventBus ----

class ServerEventBus {
    private emitter = new EventEmitter()

    constructor() {
        // Increase the listener limit since many SSE connections may subscribe
        this.emitter.setMaxListeners(500)
    }

    /** Emit an event to all SSE clients subscribed to a specific server */
    emit<T extends ServerEventType>(serverId: string, type: T, data: ServerEventMap[T]) {
        // Debug-level: high volume (fires per log/player-status update), but
        // this is the one point where a sync-cycle's correlation ID can be
        // tied to the SSE delivery it triggers — see request-context.ts.
        log.debug("event emitted", { serverId, type })
        this.emitter.emit(`server:${serverId}`, type, data)
    }

    /** Subscribe to all events for a given server. Returns an unsubscribe function. */
    subscribe(serverId: string, listener: Listener): () => void {
        const channel = `server:${serverId}`
        this.emitter.on(channel, listener)
        return () => this.emitter.off(channel, listener)
    }
}

// Module-singleton — shared across all Next.js Route Handlers in the same process
declare global {
    // eslint-disable-next-line no-var
    var __powEventBus: ServerEventBus | undefined
}

export const eventBus: ServerEventBus =
    globalThis.__powEventBus ?? (globalThis.__powEventBus = new ServerEventBus())
