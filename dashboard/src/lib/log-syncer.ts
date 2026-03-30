import { prisma } from "@/lib/db"
import { PrcClient } from "@/lib/prc"
import { PrcPlayer, PrcJoinLog, PrcKillLog, PrcCommandLog, parsePrcPlayer } from "./prc-types"
import { getRobloxUser } from "@/lib/roblox"
import { RaidDetectorService, Detection } from "@/lib/raid-detector"
import { findMemberByRobloxId } from "@/lib/clerk-lookup"
import { Prisma } from "@prisma/client"

async function getAutomationEngine() {
    const { AutomationEngine } = await import("@/lib/automation-engine")
    return AutomationEngine
}

function logToDbFormat(log: any, serverId: string): any {
    if (log._type === "join") {
        return {
            serverId,
            type: "join",
            playerName: log.PlayerName,
            playerId: log.PlayerId,
            isJoin: log.Join !== false,
            prcTimestamp: log.timestamp
        }
    } else if (log._type === "kill") {
        return {
            serverId,
            type: "kill",
            killerName: log.KillerName,
            killerId: log.KillerId,
            victimName: log.VictimName,
            victimId: log.VictimId,
            prcTimestamp: log.timestamp
        }
    } else if (log._type === "command") {
        return {
            serverId,
            type: "command",
            playerName: log.PlayerName,
            playerId: log.PlayerId,
            command: log.Command,
            prcTimestamp: log.timestamp
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

    const member = await prisma.member.findFirst({
        where: { serverId, userId: playerId },
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
            await prisma.$transaction(async (tx: any) => {
                const existing = await tx.shift.findFirst({
                    where: { userId: member.userId, serverId, endTime: null }
                })
                if (existing) throw new Error("Shift already active")
                
                await tx.shift.create({
                    data: { userId: member.userId, serverId, startTime: new Date() }
                })
            })
            await client.executeCommand(`:pm ${playerName} [POW] Shift started on ${serverName}.`).catch(() => { })
        } catch (e: any) {
            // If the transaction fails because a shift became active in the meantime, we ignore it.
            // The first request will have successfully sent the start message.
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

    if (activeShifts.length > 0) {
        await Promise.all(activeShifts.map((shift: any) => {
            const duration = Math.floor((now.getTime() - shift.startTime.getTime()) / 1000)
            return prisma.shift.update({
                where: { id: shift.id },
                data: { endTime: now, duration }
            })
        }))
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
            await client.executeCommand(`:pm ${playerName} [POW] Player not found.`).catch(() => { })
            return
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
        const [join, kill, command] = await Promise.all([
            client.getJoinLogs().catch(() => [] as PrcJoinLog[]),
            client.getKillLogs().catch(() => [] as PrcKillLog[]),
            client.getCommandLogs().catch(() => [] as PrcCommandLog[])
        ])

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

        if (uniqueDbLogs.length === 0) return { parsedLogs, newLogsCount: 0 }

        // Batch create unique logs
        const { count: newLogsCount } = await prisma.log.createMany({
            data: uniqueDbLogs
        })

        if (newLogsCount > 0) {
            const AutomationEngine = await getAutomationEngine()
            const newCommandLogsForDetection: any[] = []

            // Trigger automations for the new logs
            for (const log of parsedLogs) {
                const type = log._type
                const context = {
                    serverId,
                    player: { name: (log as any).PlayerName || (log as any).KillerName || "Unknown", id: (log as any).PlayerId || (log as any).KillerId || "" }
                }

                if (type === "join") {
                    AutomationEngine.trigger(log.Join !== false ? "PLAYER_JOIN" : "PLAYER_LEAVE", context).catch(() => {})
                } else if (type === "command") {
                    const cmd = log.Command?.toLowerCase()
                    if (cmd?.startsWith(":log ")) await handleLogCommand(log, serverId, client)
                    if (cmd === ":shutdown" || cmd?.startsWith(":shutdown ")) await handleShutdownCommand(log, serverId)
                    
                    newCommandLogsForDetection.push({ ...log, playerName: log.PlayerName, playerId: log.PlayerId, command: log.Command })
                    AutomationEngine.trigger("COMMAND_USED", { ...context, details: { command: log.Command } }).catch(() => {})
                } else if (type === "kill") {
                    AutomationEngine.trigger("PLAYER_KILL", { ...context, target: { name: log.VictimName, id: log.VictimId } }).catch(() => {})
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
