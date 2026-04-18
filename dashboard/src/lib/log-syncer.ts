import { prisma } from "@/lib/db"
import { PrcClient } from "@/lib/prc"
import { PrcPlayer, PrcJoinLog, PrcKillLog, PrcCommandLog, parsePrcPlayer } from "./prc-types"
import { getRobloxUser } from "@/lib/roblox"
import { RaidDetectorService, Detection } from "@/lib/raid-detector"
import { findMemberByRobloxId } from "@/lib/clerk-lookup"
import { eventBus } from "@/lib/event-bus"
// import { Prisma } from "@prisma/client"

async function getAutomationEngine() {
    const { AutomationEngine } = await import("@/lib/automation-engine")
    return AutomationEngine
}

function logToDbFormat(log: any, serverId: string): any {
    if (log._type === "join") {
        const p = parsePrcPlayer(log.Player || "")
        return {
            serverId,
            type: "join",
            playerName: p.name,
            playerId: p.id,
            isJoin: log.Join !== false,
            prcTimestamp: log.Timestamp || log.timestamp
        }
    } else if (log._type === "kill") {
        const killer = parsePrcPlayer(log.Killer || "")
        const victim = parsePrcPlayer(log.Killed || "")
        return {
            serverId,
            type: "kill",
            killerName: killer.name,
            killerId: killer.id,
            victimName: victim.name,
            victimId: victim.id,
            prcTimestamp: log.Timestamp || log.timestamp
        }
    } else if (log._type === "command") {
        const p = parsePrcPlayer(log.Player || "")
        return {
            serverId,
            type: "command",
            playerName: p.name,
            playerId: p.id,
            command: log.Command,
            prcTimestamp: log.Timestamp || log.timestamp
        }
    }
    return null
}

/**
 * Handle :log shift start|end|status commands
 */
async function handleShiftCommand(log: any, serverId: string, client: PrcClient, args: string[]) {
    const subcommand = args[0]?.toLowerCase()
    const playerId = log.PlayerId
    const playerName = log.PlayerName || parsePrcPlayer(log.Player).name

    // Use robloxId as log.PlayerId represents the in-game Roblox profile, not Clerk user
    const member = await prisma.member.findFirst({
        where: { serverId, robloxId: String(playerId) },
        include: { role: true, server: true }
    })

    if (!member) {
        await client.executeCommand(`:pm ${playerName} [POW] You are not registered as staff.`).catch(() => { })
        return
    }

    const serverName = member.server.customName || member.server.name

    if (subcommand === "start") {
        const activeShift = await prisma.shift.findFirst({
            where: { userId: member.userId, serverId, endTime: null }
        })

        if (activeShift) {
            const duration = Math.floor((Date.now() - activeShift.startTime.getTime()) / 1000)
            const h = Math.floor(duration / 3600)
            const m = Math.floor((duration % 3600) / 60)
            await client.executeCommand(`:pm ${playerName} [POW] You are already on shift! (${h}h ${m}m)`).catch(() => { })
            return
        }

        try {
            const players = await client.getPlayers()
            if (players.length === 0) {
                await client.executeCommand(`:pm ${playerName} [POW] Cannot go on duty - server has no players`).catch(() => { })
                return
            }
        } catch (apiError) {
            await client.executeCommand(`:pm ${playerName} [POW] Cannot go on duty - server appears offline`).catch(() => { })
            return
        }

        try {
            const shiftId = await prisma.$transaction(async (tx: any) => {
                const existing = await tx.shift.findFirst({
                    where: { userId: member.userId, serverId, endTime: null }
                })
                if (existing) throw new Error("Shift already active")

                const shift = await tx.shift.create({
                    data: { userId: member.userId, serverId, startTime: new Date() }
                })
                return shift.id
            })
            
            const newShift = await prisma.shift.findUnique({ where: { id: shiftId } })
            
            const engine = await getAutomationEngine()
            engine.trigger("SHIFT_START", {
                serverId,
                player: { name: playerName, id: member.userId }
            }).catch(() => {})

            if (newShift) {
                eventBus.emit(serverId, 'shift-status', {
                    shift: { id: newShift.id, startTime: newShift.startTime.toISOString() }
                })
            }
            const onDutyNow = await prisma.shift.findMany({ where: { serverId, endTime: null }, select: { userId: true } })
            eventBus.emit(serverId, 'staff-on-duty-ids', onDutyNow.map(s => s.userId))

            await client.executeCommand(`:pm ${playerName} [POW] Shift started on ${serverName}.`).catch(() => { })
        } catch (e: any) {
            // If the transaction fails because a shift became active, we ignore it.
        }

    } else if (subcommand === "end") {
        const activeShift = await prisma.shift.findFirst({
            where: { userId: member.userId, serverId, endTime: null }
        })

        if (!activeShift) {
            await client.executeCommand(`:pm ${playerName} [POW] You are not currently on shift.`).catch(() => { })
            return
        }

        const now = new Date()
        const duration = Math.floor((now.getTime() - activeShift.startTime.getTime()) / 1000)

        await prisma.shift.update({
            where: { id: activeShift.id },
            data: { endTime: now, duration }
        })

        const engine = await getAutomationEngine()
        engine.trigger("SHIFT_END", {
            serverId,
            player: { name: playerName, id: member.userId },
            details: { duration }
        }).catch(() => {})

        const { processMilestones } = await import("@/lib/milestones")
        await processMilestones(member.userId, serverId).catch(() => {})

        eventBus.emit(serverId, 'shift-status', { shift: null })
        const onDutyNow = await prisma.shift.findMany({ where: { serverId, endTime: null }, select: { userId: true } })
        eventBus.emit(serverId, 'staff-on-duty-ids', onDutyNow.map(s => s.userId))

        const h = Math.floor(duration / 3600)
        const m = Math.floor((duration % 3600) / 60)
        await client.executeCommand(`:pm ${playerName} [POW] Shift ended. Duration: ${h}h ${m}m`).catch(() => { })

    } else if (subcommand === "status") {
        const activeShift = await prisma.shift.findFirst({
            where: { userId: member.userId, serverId, endTime: null }
        })

        const now = new Date()
        const currentDay = now.getDay()
        const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1)
        const weekStart = new Date(now)
        weekStart.setDate(diff)
        weekStart.setHours(0, 0, 0, 0)

        const weeklyShifts = await prisma.shift.findMany({
            where: { serverId, userId: member.userId, startTime: { gte: weekStart } }
        })

        let totalSeconds = 0
        for (const shift of weeklyShifts) {
            totalSeconds += shift.duration || (shift.endTime ? 0 : Math.floor((Date.now() - shift.startTime.getTime()) / 1000))
        }

        const totalH = Math.floor(totalSeconds / 3600)
        const totalM = Math.floor((totalSeconds % 3600) / 60)
        const quotaMinutes = member.role?.quotaMinutes || 0
        const quotaSeconds = quotaMinutes * 60
        const quotaPercent = quotaSeconds > 0 ? Math.round((totalSeconds / quotaSeconds) * 100) : 100

        await client.executeCommand(`:pm ${playerName} [POW] ${activeShift ? 'ON DUTY' : 'OFF DUTY'} | Weekly: ${totalH}h ${totalM}m (${quotaPercent}% of quota)`).catch(() => { })
    }
}

async function handleShutdownCommand(log: any, serverId: string) {
    const playerName = log.PlayerName || parsePrcPlayer(log.Player).name
    const now = new Date()

    const activeShifts = await prisma.shift.findMany({
        where: { serverId, endTime: null }
    })

    // ⚡ Bolt: Using $transaction to batch all individual shift updates into a single database transaction,
    // drastically reducing overhead from N+1 concurrent transactions during server shutdowns.
    if (activeShifts.length > 0) {
        await prisma.$transaction(
            activeShifts.map((shift: any) => {
                const duration = Math.floor((now.getTime() - shift.startTime.getTime()) / 1000)
                return prisma.shift.update({
                    where: { id: shift.id },
                    data: { endTime: now, duration }
                })
            })
        )

        const engine = await getAutomationEngine()
        const { processMilestones } = await import("@/lib/milestones")

        for (const shift of activeShifts) {
            const duration = Math.floor((now.getTime() - shift.startTime.getTime()) / 1000)
            engine.trigger("SHIFT_END", {
                serverId,
                player: { name: "System Shutdown", id: shift.userId },
                details: { duration }
            }).catch(() => {})
            
            processMilestones(shift.userId, serverId).catch(() => {})
        }

        eventBus.emit(serverId, 'staff-on-duty-ids', [])
    }

    const shutdownEventKey = `ssd_${serverId}`
    await prisma.config.upsert({
        where: { key: shutdownEventKey },
        update: {
            value: JSON.stringify({
                timestamp: now.toISOString(),
                initiatedBy: playerName,
                shiftsEnded: activeShifts.length,
                affectedUserIds: activeShifts.map((s: any) => s.userId)
            })
        },
        create: {
            key: shutdownEventKey,
            value: JSON.stringify({
                timestamp: now.toISOString(),
                initiatedBy: playerName,
                shiftsEnded: activeShifts.length,
                affectedUserIds: activeShifts.map((s: any) => s.userId)
            })
        }
    })
}

async function handleLogCommand(log: any, serverId: string, client: PrcClient) {
    const fullCommand = log.Command || ""
    const playerName = log.PlayerName || parsePrcPlayer(log.Player).name
    const logMatch = fullCommand.match(/^:log\s+(.*)$/i)
    if (!logMatch) return

    const parts = logMatch[1].trim().split(/\s+/)
    if (parts.length < 1) return

    const typeArg = parts[0].toLowerCase()
    if (typeArg === "shift") {
        await handleShiftCommand(log, serverId, client, parts.slice(1))
        return
    }

    if (parts.length < 2) return
    const targetQuery = parts[1].toLowerCase()
    const reason = parts.slice(2).join(" ") || "No reason provided"

    const typeMap: Record<string, string> = { "warn": "Warn", "kick": "Kick", "ban": "Ban", "bolo": "Ban Bolo" }
    const punishmentType = typeMap[typeArg]
    if (!punishmentType) return

    try {
        const players = await client.getPlayers().catch(() => [] as any[])
        let matches = players.filter((p: any) => parsePrcPlayer(p.Player).name.toLowerCase().includes(targetQuery))
        let target: { name: string; id: string } | null = null

        if (matches.length === 1) {
            target = parsePrcPlayer(matches[0].Player)
        } else if (matches.length === 0) {
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
            const recentLeaveLogs = await prisma.log.findMany({
                where: { serverId, type: "join", isJoin: false, createdAt: { gte: thirtyMinutesAgo }, playerName: { contains: targetQuery } },
                orderBy: { createdAt: "desc" },
                take: 1
            })
            if (recentLeaveLogs[0]) target = { name: recentLeaveLogs[0].playerName!, id: recentLeaveLogs[0].playerId! }
        }

        if (!target) {
            // Un-cached full lookup via Roblox API (useful for offline users or custom manual commands)
            const rbxUser = await getRobloxUser(parts[1])
            if (rbxUser) {
                target = { name: rbxUser.name, id: String(rbxUser.id) }
            } else {
                await client.executeCommand(`:pm ${playerName} [POW] Player not found on Roblox or in-game.`).catch(() => { })
                return
            }
        }

        await prisma.punishment.create({
            data: {
                serverId,
                userId: target.id,
                moderatorId: String(log.PlayerId),
                type: punishmentType,
                reason: `[Game Command by ${playerName}] ${reason}`
            }
        })

        await client.executeCommand(`:pm ${playerName} [POW] ${punishmentType} logged for ${target.name}`).catch(() => { })

        const engine = await getAutomationEngine()
        engine.trigger("PUNISHMENT_ISSUED", {
            serverId,
            player: { name: target.name, id: target.id },
            punishment: { type: punishmentType, reason, issuer: playerName, target: target.name }
        }).catch(() => { })

    } catch (e) {
        console.error("[LOG-CMD] Error:", e)
    }
}

export async function fetchAndSaveLogs(apiKey: string, serverId: string) {
    const client = new PrcClient(apiKey)

    try {
        const v2 = await client.getServerV2({
            Players: true,
            Staff: true,
            JoinLogs: true,
            KillLogs: true,
            CommandLogs: true,
            ModCalls: true,
            EmergencyCalls: true,
            Vehicles: true
        })

        const join = v2.JoinLogs || []
        const kill = v2.KillLogs || []
        const command = v2.CommandLogs || []

        const parsedLogs = [
            ...join.map((l: any) => {
                const p = parsePrcPlayer(l.Player)
                return { ...l, _type: "join", timestamp: l.Timestamp, PlayerName: p.name, PlayerId: p.id }
            }),
            ...kill.map((l: any) => {
                const killer = parsePrcPlayer(l.Killer)
                const victim = parsePrcPlayer(l.Killed)
                return { ...l, _type: "kill", timestamp: l.Timestamp, KillerName: killer.name, KillerId: killer.id, VictimName: victim.name, VictimId: victim.id }
            }),
            ...command.map((l: any) => {
                const p = parsePrcPlayer(l.Player)
                return { ...l, _type: "command", timestamp: l.Timestamp, PlayerName: p.name, PlayerId: p.id, Command: l.Command }
            })
        ]

        if (parsedLogs.length === 0) return { parsedLogs: [], newLogsCount: 0 }

        const dbLogs = parsedLogs.map(l => logToDbFormat(l, serverId)).filter((l): l is any => l !== null)

        // Manual deduplication for SQLite (which doesn't support skipDuplicates: true)
        // 1. Get all timestamps from the logs we're trying to insert
        const timestamps = dbLogs.map(l => l.prcTimestamp).filter(t => t !== null) as number[]

        // 2. Fetch existing logs with those timestamps for this server
        const existingLogs = await prisma.log.findMany({
            where: {
                serverId,
                prcTimestamp: { in: timestamps }
            },
            select: { type: true, prcTimestamp: true, playerId: true, killerId: true, victimId: true }
        })

        // 3. Create a set of unique keys already in the DB
        // Fingerprint: type_timestamp_player_killer_victim
        const getLogKey = (l: any) => `${l.type}_${l.prcTimestamp}_${l.playerId || ''}_${l.killerId || ''}_${l.victimId || ''}`
        const existingKeys = new Set(existingLogs.map(getLogKey))

        // 4. Filter out logs that already exist
        const uniqueDbLogs = dbLogs.filter(l => !existingKeys.has(getLogKey(l)))

        if (uniqueDbLogs.length > 0) {
            // Batch create unique logs
            await prisma.log.createMany({
                data: uniqueDbLogs
            })
            // Push new logs to SSE clients
            const logsForSSE = parsedLogs.filter(l => uniqueDbLogs.some(d => `${d.type}_${d.prcTimestamp}` === `${(l as any)._type}_${l.timestamp}`))
            if (logsForSSE.length > 0) {
                eventBus.emit(serverId, 'logs', logsForSSE as any)
            }
        }

        // --- PRC V2 DATA SYNC ---

        // 1. Player Locations
        if (v2.Players && v2.Players.length > 0) {
            const locationData = v2.Players.filter(p => p.Location).map(p => {
                const details = parsePrcPlayer(p.Player)
                return {
                    serverId,
                    userId: details.id,
                    playerName: details.name,
                    locationX: p.Location!.LocationX,
                    locationZ: p.Location!.LocationZ,
                    postalCode: p.Location!.PostalCode,
                    streetName: p.Location!.StreetName,
                    buildingNumber: p.Location!.BuildingNumber
                }
            })
            if (locationData.length > 0) {
                await prisma.playerLocation.createMany({ data: locationData })

                // Push player list to all SSE clients for this server
                const parsedForSSE = v2.Players!.map(p => {
                    const details = parsePrcPlayer(p.Player)
                    return {
                        id: details.id,
                        name: details.name,
                        team: p.Team,
                        permission: p.Permission,
                        vehicle: p.Vehicle,
                        callsign: p.Callsign,
                        location: p.Location ? {
                            x: p.Location.LocationX,
                            z: p.Location.LocationZ,
                            postal: p.Location.PostalCode,
                            street: p.Location.StreetName,
                            building: p.Location.BuildingNumber
                        } : null
                    }
                })
                eventBus.emit(serverId, 'players', parsedForSSE)

                // Push server-stats
                eventBus.emit(serverId, 'server-stats', {
                    players: parsedForSSE.length,
                    maxPlayers: (v2 as any).MaxPlayers || 0,
                    online: parsedForSSE.length > 0
                })
            }
        }

        // 2. Mod Calls
        if (v2.ModCalls && v2.ModCalls.length > 0) {
            // Find recent mod calls for this server (within last hour)
            const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
            const recentCalls = await prisma.modCall.findMany({
                where: { serverId, createdAt: { gte: hourAgo } },
                orderBy: { createdAt: "desc" }
            })

            for (const c of v2.ModCalls) {
                const caller = parsePrcPlayer(c.Caller)
                const moderator = c.Moderator ? parsePrcPlayer(c.Moderator) : null

                // Try to find an existing call by this caller
                // Best match is one with the exact timestamp, otherwise the most recent one
                let existingCall = recentCalls.find(call => call.callerId === caller.id && call.timestamp === c.Timestamp)
                if (!existingCall) {
                    existingCall = recentCalls.find(call => call.callerId === caller.id)
                }

                let newResponders: string[] = []
                if (moderator) {
                    newResponders = [moderator.id]
                }

                if (existingCall) {
                    // Call exists. Check if we need to update responders
                    let currentResponders: string[] = []
                    if (existingCall.respondingPlayers) {
                        try { currentResponders = JSON.parse(existingCall.respondingPlayers) } catch { }
                    }

                    if (moderator && !currentResponders.includes(moderator.id)) {
                        currentResponders.push(moderator.id)
                        const newRespondersStr = JSON.stringify(currentResponders)
                        await prisma.modCall.update({
                            where: { id: existingCall.id },
                            data: { respondingPlayers: newRespondersStr }
                        })
                        // update local cache so we don't spam updates
                        existingCall.respondingPlayers = newRespondersStr
                    }
                } else {
                    // Call doesn't exist at all (webhook must have missed it). Create a fallback record.
                    const newCall = await prisma.modCall.create({
                        data: {
                            serverId,
                            callerId: caller.id,
                            callerName: caller.name,
                            respondingPlayers: newResponders.length > 0 ? JSON.stringify(newResponders) : null,
                            timestamp: c.Timestamp
                        }
                    })
                    recentCalls.push(newCall) // add to cache

                    const AutomationEngine = await getAutomationEngine()
                    AutomationEngine.trigger("MOD_CALL", {
                        serverId,
                        player: {
                            name: caller.name || "Unknown",
                            id: caller.id,
                            location: { x: 0, z: 0, postal: null, street: null }
                        },
                        details: { description: null, callNumber: null }
                    }).catch(() => { })
                }
            }
        }

        // 3. Emergency Calls
        if (v2.EmergencyCalls && v2.EmergencyCalls.length > 0) {
            const emerCallTimestamps = v2.EmergencyCalls.map(c => c.Timestamp)
            const existingEmerCalls = await prisma.emergencyCall.findMany({
                where: { serverId, timestamp: { in: emerCallTimestamps } },
                select: { timestamp: true, callNumber: true }
            })
            const existingEmerKeys = new Set(existingEmerCalls.map((c: any) => `${c.timestamp}_${c.callNumber}`))

            const newEmerCalls = v2.EmergencyCalls.filter(c => !existingEmerKeys.has(`${c.Timestamp}_${c.CallNumber}`)).map(c => {
                const details = parsePrcPlayer(c.Caller)
                return {
                    serverId,
                    team: c.Team,
                    callerId: details.id,
                    callerName: details.name,
                    description: c.Description,
                    callNumber: c.CallNumber,
                    positionX: c.Position ? c.Position[0] : 0,
                    positionZ: c.Position ? c.Position[1] : 0,
                    positionDescriptor: c.PositionDescriptor,
                    timestamp: c.Timestamp
                }
            })
            if (newEmerCalls.length > 0) {
                await prisma.emergencyCall.createMany({ data: newEmerCalls })
                const AutomationEngine = await getAutomationEngine()
                for (const call of newEmerCalls) {
                    AutomationEngine.trigger("EMERGENCY_CALL", {
                        serverId,
                        player: {
                            name: call.callerName || "Unknown",
                            id: call.callerId,
                            location: { x: call.positionX || 0, z: call.positionZ || 0, postal: null, street: null }
                        },
                        details: { team: call.team, description: call.description, callNumber: call.callNumber, positionDescriptor: call.positionDescriptor }
                    }).catch(() => { })
                }
            }
        }

        // Push updated calls snapshot to SSE clients after all call saves
        if (v2.ModCalls?.length || v2.EmergencyCalls?.length) {
            try {
                const [rawModCalls, latestEmerCalls] = await Promise.all([
                    prisma.modCall.findMany({ where: { serverId }, orderBy: { timestamp: 'desc' }, take: 400 }),
                    prisma.emergencyCall.findMany({ where: { serverId }, orderBy: { timestamp: 'desc' }, take: 50 })
                ])

                // Deduplicate ModCalls based on timestamp and callerId (to handle past loop duplicates safely)
                const uniqueCallsMap = new Map<string, any>()
                for (const call of rawModCalls) {
                    const key = `${call.timestamp}_${call.callerId}`
                    const existing = uniqueCallsMap.get(key)
                    if (!existing) {
                        uniqueCallsMap.set(key, call)
                    } else if (!existing.respondingPlayers && call.respondingPlayers) {
                        // Prefer duplicate that has responders
                        uniqueCallsMap.set(key, call)
                    } else if (existing.respondingPlayers && call.respondingPlayers) {
                        // Safely merge responders if both exist on duplicates
                        try {
                            const eResp = JSON.parse(existing.respondingPlayers)
                            const cResp = JSON.parse(call.respondingPlayers)
                            existing.respondingPlayers = JSON.stringify(Array.from(new Set([...eResp, ...cResp])))
                        } catch { }
                    }
                }
                const latestModCalls = Array.from(uniqueCallsMap.values()).slice(0, 50)

                eventBus.emit(serverId, 'calls', { modCalls: latestModCalls, emergencyCalls: latestEmerCalls })
            } catch { /* non-critical */ }
        }

        // 4. Vehicles
        if (v2.Vehicles && v2.Vehicles.length > 0) {
            const vehicleData = v2.Vehicles.map(v => {
                const details = parsePrcPlayer(v.Owner)
                return {
                    serverId,
                    ownerId: details.id,
                    ownerName: details.name,
                    vehicleName: v.Name,
                    licensePlate: v.LicensePlate,
                    color: v.Color,
                    livery: v.Livery,
                    positionX: v.Position ? v.Position[0] : 0,
                    positionZ: v.Position ? v.Position[1] : 0,
                    timestamp: v.Timestamp
                }
            })
            // For vehicles, we just snapshot for now (or could deduplicate like calls)
            if (vehicleData.length > 0) {
                await prisma.vehicleLog.createMany({ data: vehicleData })
            }
        }

        const newLogsCount = uniqueDbLogs.length
        if (newLogsCount > 0) {
            const AutomationEngine = await getAutomationEngine()
            const newCommandLogsForDetection: any[] = []

            // Trigger automations and handlers ONLY for logs that were determined to be new
            for (const log of parsedLogs) {
                const logKey = getLogKey(logToDbFormat(log, serverId))
                if (!existingKeys.has(logKey)) {
                    const type = log._type
                    const context = {
                        serverId,
                        player: { name: (log as any).PlayerName || (log as any).KillerName || "Unknown", id: (log as any).PlayerId || (log as any).KillerId || "" }
                    }

                    if (type === "join") {
                        AutomationEngine.trigger(log.Join !== false ? "PLAYER_JOIN" : "PLAYER_LEAVE", context).catch(() => { })
                    } else if (type === "command") {
                        const cmd = log.Command?.toLowerCase()
                        if (cmd?.startsWith(":log ")) await handleLogCommand(log, serverId, client)
                        if (cmd === ":shutdown" || cmd?.startsWith(":shutdown ")) await handleShutdownCommand(log, serverId)

                        newCommandLogsForDetection.push({ ...log, playerName: log.PlayerName, playerId: log.PlayerId, command: log.Command })
                        AutomationEngine.trigger("COMMAND_USED", { ...context, details: { command: log.Command } }).catch(() => { })
                    } else if (type === "kill") {
                        AutomationEngine.trigger("PLAYER_KILL", { ...context, target: { name: log.VictimName, id: log.VictimId } }).catch(() => { })
                    }
                }
            }

            // Run Raid Detection
            if (newCommandLogsForDetection.length > 0) {
                try {
                    const server = await prisma.server.findUnique({
                        where: { id: serverId },
                        select: { raidAlertChannelId: true, staffRoleId: true, id: true, name: true, subscriptionPlan: true }
                    })

                    const { getServerPlan } = await import("@/lib/subscription")
                    const { isServerFeatureEnabled } = await import("@/lib/feature-flags")

                    const flagEnabled = await isServerFeatureEnabled('RAID_DETECTION', serverId)
                    const { hasRaidDetection } = await getServerPlan(serverId)

                    if (flagEnabled && hasRaidDetection && server?.raidAlertChannelId) {
                        const logsWithMemberInfo = await Promise.all(newCommandLogsForDetection.map(async (log: any) => {
                            const playerName = log.playerName || "Unknown"
                            const playerId = log.playerId || "0"
                            if (playerName === "Remote Server" || playerId === "0") return { log, isAuthorized: true }
                            const { member } = await findMemberByRobloxId(serverId, playerId)
                            return { log, isAuthorized: !!member }
                        }))

                        const filteredLogs = logsWithMemberInfo.filter((item: any) => !item.isAuthorized).map((item: any) => item.log)

                        if (filteredLogs.length > 0) {
                            const detector = new RaidDetectorService()
                            const detections = detector.scan(filteredLogs, [])
                            if (detections.length > 0) {
                                const staffPing = server.staffRoleId ? `<@&${server.staffRoleId}>` : "@staff"
                                const embed = {
                                    title: "⚠️ RAID DETECTION ALERT",
                                    description: `Suspicious activity detected on **${server.name}**\n${staffPing} Please investigate immediately.`,
                                    color: 0xFF0000,
                                    fields: detections.map((d: any) => ({
                                        name: `${d.type}`,
                                        value: `**Roblox User:** ${d.userName} (ID: \`${d.userId}\`)\n**Details:** ${d.details}`,
                                        inline: false
                                    })),
                                    timestamp: new Date().toISOString()
                                }
                                await prisma.botQueue.create({
                                    data: { serverId, type: "MESSAGE", targetId: server.raidAlertChannelId, content: JSON.stringify({ embeds: [embed] }) }
                                })
                            }
                        }
                    }
                } catch (e) {
                    console.error("[RAID DETECTOR] Error:", e)
                }
            }
        }

        return { parsedLogs, newLogsCount }
    } catch (error) {
        console.error("[SYNC] Fatal Error:", error)
        return { parsedLogs: [], newLogsCount: 0 }
    }
}
