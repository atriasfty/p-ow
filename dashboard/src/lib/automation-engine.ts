import { prisma } from "@/lib/db"
import { PrcClient } from "@/lib/prc"
import { getServerConfig } from "@/lib/server-config"
import { getServerOverride } from "./config"

// Define expanded triggers
export type TriggerType =
    | "PLAYER_JOIN" | "PLAYER_LEAVE"
    | "SHIFT_START" | "SHIFT_END"
    | "PUNISHMENT_ISSUED" | "WARN_ISSUED" | "KICK_ISSUED" | "BAN_ISSUED"
    | "MEMBER_ROLE_UPDATED"
    | "COMMAND_USED" | "PLAYER_KILL"
    | "PLAYER_DEATH" | "SERVER_STARTUP"
    | "BOLO_CREATED" | "BOLO_CLEARED"
    | "DISCORD_MESSAGE_RECEIVED"
    | "TIME_INTERVAL"

export interface AutomationContext {
    serverId: string
    player?: {
        name: string
        id: string
        team?: string
        permission?: number
        vehicle?: string
        callsign?: string
        [key: string]: any
    }
    punishment?: {
        type: string
        reason: string
        issuer: string
        target: string
    }
    target?: {
        name: string
        id: string
    }
    details?: any
}

// Optimization 3: Cache automations to avoid database spam
const automationsCache = new Map<string, { data: any[], timestamp: number }>()

export class AutomationEngine {
    private static async getAutomationsForServer(serverId: string) {
        const cacheTtl = await getServerOverride(serverId, "automationCacheTtl")
        const cached = automationsCache.get(serverId)
        if (cached && Date.now() - cached.timestamp < cacheTtl) {
            return cached.data
        }

        const automations = await prisma.automation.findMany({
            where: { serverId, enabled: true }
        })
        automationsCache.set(serverId, { data: automations, timestamp: Date.now() })
        return automations
    }

    static async tick(serverId: string) {
        try {
            const allAutomations = await this.getAutomationsForServer(serverId)
            const timeAutomations = allAutomations.filter(a => a.trigger === "TIME_INTERVAL")

            const now = new Date()
            for (const automation of timeAutomations) {
                try {
                    const conditionsStr = automation.conditions || "{}"
                    let intervalMinutes = 60

                    try {
                        const parsed = JSON.parse(conditionsStr)
                        if (!Array.isArray(parsed) && parsed.intervalMinutes) {
                            intervalMinutes = parseInt(parsed.intervalMinutes) || 60
                        }
                    } catch (e) {
                        // Silent fail
                    }

                    const lastRun = automation.lastRunAt ? new Date(automation.lastRunAt).getTime() : 0
                    const nextRun = lastRun + (intervalMinutes * 60 * 1000)

                    if (now.getTime() >= nextRun) {
                        await this.trigger("TIME_INTERVAL", { serverId }, automation)
                    }
                } catch (e) {
                    console.error(`[AUTOMATION] Error ticking automation ${automation.name}:`, e)
                }
            }
        } catch (e) {
            console.error(`[AUTOMATION] Error in engine tick for ${serverId}:`, e)
        }
    }

    static async trigger(type: TriggerType, context: AutomationContext, specificAutomation?: any) {
        try {
            const server = await getServerConfig(context.serverId)
            if (!server) return

            const prcClient = new PrcClient(server.apiUrl)
            let serverInfo: any = null

            let automations: any[]
            if (specificAutomation) {
                automations = [specificAutomation]
            } else {
                const all = await this.getAutomationsForServer(context.serverId)
                automations = all.filter(a => a.trigger === type)
            }

            if (automations.length === 0) return

            for (const automation of automations) {
                let conditionsMet = true
                if (automation.conditions && automation.conditions !== "{}" && automation.conditions !== "[]") {
                    try {
                        const conditions = JSON.parse(automation.conditions)
                        if (JSON.stringify(conditions).includes("server.") && !serverInfo) {
                            serverInfo = await prcClient.getServer()
                        }
                        conditionsMet = await this.evaluateGroup(conditions, context, serverInfo)
                    } catch (e) {
                        conditionsMet = false
                    }
                }

                if (!conditionsMet) continue

                // Update lastRunAt BEFORE executing actions to prevent race conditions (especially with DELAY)
                await prisma.automation.update({
                    where: { id: automation.id },
                    data: { lastRunAt: new Date() }
                }).catch(() => {})

                const actions = JSON.parse(automation.actions)
                for (const action of actions) {
                    try {
                        if (JSON.stringify(action).includes("{server_") && !serverInfo) {
                            serverInfo = await prcClient.getServer()
                        }
                        await this.executeAction(action, context, prcClient, serverInfo)
                    } catch (e) {
                        console.error(`[AUTOMATION] Error executing action ${action.type}:`, e)
                    }
                }
            }
        } catch (e) {
            console.error(`[AUTOMATION] Error processing trigger ${type}: `, e)
        }
    }

    private static isPrivateIp(hostname: string): boolean {
        const host = hostname.toLowerCase()
        if (host === "localhost" || host === "::1" || host.endsWith(".local")) return true

        // Check for common private IP patterns (IPv4)
        // 127.0.0.1/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
        const privateIpv4Regex = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|169\.254\.)/
        if (privateIpv4Regex.test(host)) return true

        // Basic check for IPv6 private/link-local (fc00::/7, fe80::/10)
        if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8")) return true

        return false
    }

    private static sanitizeCommandArg(text: string): string {
        // PRC commands use spaces as delimiters, so wrap in quotes and escape internal quotes
        // We only want to escape double quotes since that's what we use for wrapping
        return text.replace(/"/g, '\\"')
    }

    private static async evaluateGroup(group: any, context: AutomationContext, serverData: any): Promise<boolean> {
        if (Array.isArray(group)) {
            for (const condition of group) {
                if (!await this.evaluateCondition(condition, context, serverData)) return false
            }
            return true
        }
        return true
    }

    private static async evaluateCondition(condition: any, context: AutomationContext, serverData: any): Promise<boolean> {
        const { field, operator, value } = condition
        let actualValue: any = null

        if (field.startsWith("player.")) {
            const key = field.split(".")[1]
            actualValue = context.player ? (context.player as any)[key] : null
        } else if (field.startsWith("server.")) {
            const key = field.split(".")[1]
            if (key === "playerCount" && serverData) actualValue = serverData.CurrentPlayers
            else if (key === "maxPlayers" && serverData) actualValue = serverData.MaxPlayers
            else if (key === "joinKey" && serverData) actualValue = serverData.JoinKey
        }

        switch (operator) {
            case "EQUALS": return String(actualValue) == String(value)
            case "NOT_EQUALS": return String(actualValue) != String(value)
            case "GREATER_THAN": return Number(actualValue) > Number(value)
            case "LESS_THAN": return Number(actualValue) < Number(value)
            case "CONTAINS": return String(actualValue).toLowerCase().includes(String(value).toLowerCase())
        }
        return false
    }

    private static async executeAction(action: any, context: AutomationContext, prcClient: PrcClient, serverInfo: any) {
        // For PRC commands, we want to sanitize variables to prevent injection
        const isPrcAction = ["PRC_COMMAND", "KICK_PLAYER", "BAN_PLAYER", "ANNOUNCEMENT", "TELEPORT_PLAYER", "KILL_PLAYER"].includes(action.type)
        const content = this.replaceVariables(action.content || "", context, serverInfo, isPrcAction)
        const target = this.replaceVariables(action.target || "", context, serverInfo, isPrcAction)

        switch (action.type) {
            case "DISCORD_MESSAGE":
                await prisma.botQueue.create({
                    data: { serverId: context.serverId, type: "MESSAGE", targetId: target, content: content }
                })
                break
            case "DISCORD_DM":
                await prisma.botQueue.create({
                    data: { serverId: context.serverId, type: "DM", targetId: target, content: content }
                })
                break
            case "LOG_ENTRY":
            case "SHIFT_LOG": 
                await prisma.log.create({
                    data: {
                        serverId: context.serverId,
                        type: action.type === "SHIFT_LOG" ? "SHIFT" : "AUTOMATION",
                        command: content,
                        playerId: context.player?.id || "system",
                        prcTimestamp: Math.floor(Date.now() / 1000)
                    }
                })
                break
            case "WARN_PLAYER":
                if (context.player?.id) {
                    await prisma.punishment.create({
                        data: {
                            serverId: context.serverId,
                            userId: context.player.id,
                            moderatorId: "AUTOMATION",
                            type: "Warn",
                            reason: content,
                            resolved: true
                        }
                    })
                }
                break
            case "PRC_COMMAND":
            case "KICK_PLAYER":
            case "BAN_PLAYER":
            case "ANNOUNCEMENT":
            case "TELEPORT_PLAYER":
            case "KILL_PLAYER":
                let command = content
                const pid = context.player?.id || context.player?.name || ""
                // Use sanitized name/id for command construction
                const safePid = this.sanitizeCommandArg(pid)
                const quotedPid = safePid.includes(" ") ? `"${safePid}"` : safePid
                
                if (action.type === "KICK_PLAYER") command = `:kick ${quotedPid} ${content}`
                else if (action.type === "BAN_PLAYER") command = `:ban ${quotedPid} ${content}`
                else if (action.type === "ANNOUNCEMENT") command = `:m ${content}`
                else if (action.type === "TELEPORT_PLAYER") {
                    const safeTarget = this.sanitizeCommandArg(target)
                    const quotedTarget = safeTarget.includes(" ") ? `"${safeTarget}"` : safeTarget
                    command = `:tp ${quotedPid} ${quotedTarget}` 
                }
                else if (action.type === "KILL_PLAYER") command = `:kill ${quotedPid}`
                
                await prcClient.executeCommand(command)
                break
            case "HTTP_REQUEST":
                try {
                    const url = new URL(target)
                    if (this.isPrivateIp(url.hostname)) {
                        console.warn(`[AUTOMATION] Blocked SSRF attempt to private hostname: ${url.hostname}`)
                        break
                    }
                    await fetch(target, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: content
                    })
                } catch (e) {
                    console.error("[AUTOMATION] Webhook action failed:", e)
                }
                break
            case "DELAY":
                await new Promise(resolve => setTimeout(resolve, parseInt(content) || 1000))
                break
        }
    }

    private static replaceVariables(text: string, context: AutomationContext, serverData: any, sanitize: boolean = false): string {
        const wrap = (val: string) => sanitize ? this.sanitizeCommandArg(val) : val

        let result = text
        if (context.player) {
            result = result.replace(/{player_name}/g, wrap(context.player.name))
            result = result.replace(/{player_id}/g, wrap(context.player.id))
            result = result.replace(/{player_team}/g, wrap(context.player.team || "Unknown"))
            result = result.replace(/{player_vehicle}/g, wrap(context.player.vehicle || "None"))
            result = result.replace(/{player_callsign}/g, wrap(context.player.callsign || "None"))
            result = result.replace(/%player%/g, wrap(context.player.name))
            result = result.replace(/%id%/g, wrap(context.player.id))
        }
        result = result.replace(/{server_id}/g, wrap(context.serverId))
        if (serverData) {
            result = result.replace(/{server_name}/g, wrap(serverData.Name || "Unknown Server"))
            result = result.replace(/{player_count}/g, String(serverData.CurrentPlayers || 0))
            result = result.replace(/{max_players}/g, String(serverData.MaxPlayers || 0))
            result = result.replace(/{join_key}/g, wrap(serverData.JoinKey || ""))
        }
        if (context.punishment) {
            result = result.replace(/{punishment_type}/g, wrap(context.punishment.type))
            result = result.replace(/{punishment_reason}/g, wrap(context.punishment.reason))
            result = result.replace(/{punishment_issuer}/g, wrap(context.punishment.issuer))
            result = result.replace(/{punishment_target}/g, wrap(context.punishment.target))
        }
        return result.replace(/{timestamp}/g, new Date().toISOString())
    }
}