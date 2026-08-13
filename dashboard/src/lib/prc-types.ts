
export interface PrcServer {
    Name: string
    OwnerId: number
    CoOwnerIds: number[]
    CurrentPlayers: number
    MaxPlayers: number
    JoinKey: string
    AccVerifiedReq: string
    TeamBalance: boolean
}

export interface PrcPlayer {
    Player: string // Format: "Name:UserId"
    Team: string
    Permission: number
    Vehicle: string
    Callsign: string
    Location?: {
        LocationX: number
        LocationZ: number
        PostalCode: string | null
        StreetName: string | null
        BuildingNumber: string | null
    }
}

export interface PrcJoinLog {
    Player: string
    Timestamp: number
}

export interface PrcKillLog {
    Killer: string
    Killed: string
    Timestamp: number
}

export interface PrcCommandLog {
    Player: string
    Command: string // Full command string including arguments, e.g. ":log ban username reason"
    Timestamp: number
}

export interface PrcModCall {
    Caller: string
    Moderator?: string // Only present if a moderator responded
    Timestamp: number
}

export interface PrcEmergencyCall {
    Team: string
    Caller: string
    Description: string
    CallNumber: number
    Position: [number, number]
    PositionDescriptor: string
    Timestamp: number
}

export interface PrcVehicle {
    Owner: string
    Name: string
    LicensePlate: string
    Color: string
    Livery: string
    Position: [number, number]
    Timestamp: number
}

export interface PrcServerV2 extends PrcServer {
    Players?: PrcPlayer[]
    Staff?: PrcPlayer[]
    JoinLogs?: PrcJoinLog[]
    KillLogs?: PrcKillLog[]
    CommandLogs?: PrcCommandLog[]
    ModCalls?: PrcModCall[]
    EmergencyCalls?: PrcEmergencyCall[]
    Vehicles?: PrcVehicle[]
}

export interface PrcPlayerDetails {
    name: string
    id: string
}

export function parsePrcPlayer(raw: string | null | undefined): PrcPlayerDetails {
    // PRC omits this field entirely for some entries (e.g. an environmental
    // kill has no Killer) — every call site here passes a raw API field
    // straight through, so this must degrade gracefully rather than throw
    // and take down the whole sync cycle for one log entry.
    if (typeof raw !== "string") {
        return { name: "Unknown", id: "0" }
    }
    const parts = raw.split(":")
    return {
        name: parts[0] || "Unknown",
        id: parts[1] || "0"
    }
}
