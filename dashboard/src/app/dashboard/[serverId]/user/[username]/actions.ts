
"use server"

import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { PrcClient } from "@/lib/prc"
import { getServerConfig } from "@/lib/server-config"
import { revalidatePath } from "next/cache"

export async function submitPunishment(prevState: any, formData: FormData) {
    const session = await getSession()
    if (!session) return { success: false, message: "Unauthorized" }

    const serverId = formData.get("serverId") as string
    const userId = formData.get("userId") as string
    const username = formData.get("username") as string
    const type = formData.get("type") as string
    const reason = formData.get("reason") as string

    if (!serverId || !userId || !type || !reason) {
        return { success: false, message: "Missing required fields" }
    }

    // Permission Check
    const { getUserPermissions } = await import("@/lib/admin")
    const perms = await getUserPermissions(session.user as any, serverId)

    if (type === "Warn" && !perms.canIssueWarnings) return { success: false, message: "Forbidden: Missing canIssueWarnings" }
    if (type === "Kick" && !perms.canKick) return { success: false, message: "Forbidden: Missing canKick" }
    if (type === "Ban" && !perms.canBan) return { success: false, message: "Forbidden: Missing canBan" }
    if (type === "Ban Bolo" && !perms.canBanBolo) return { success: false, message: "Forbidden: Missing canBanBolo" }

    try {
        // 1. Log to DB
        const punishment = await prisma.punishment.create({
            data: {
                serverId,
                moderatorId: session.user.robloxId || session.user.discordId || session.user.id,
                userId,
                type,
                reason,
                resolved: type === "Ban Bolo" ? false : true
            }
        })

        // Automation Trigger
        // We don't await this to keep UI snappy
        const { AutomationEngine } = await import("@/lib/automation-engine")

        const context = {
            serverId,
            player: { name: username, id: userId },
            punishment: {
                type,
                reason,
                issuer: session.user.username || "System",
                target: username
            }
        }

        // Generic Trigger
        AutomationEngine.trigger("PUNISHMENT_ISSUED", context)

        // Specific Triggers
        if (type === "Warn") AutomationEngine.trigger("WARN_ISSUED", context)
        else if (type === "Kick") AutomationEngine.trigger("KICK_ISSUED", context)
        else if (type.startsWith("Ban")) AutomationEngine.trigger("BAN_ISSUED", context)

        // 2. Execute Command via PRC
        try {
            const server = await getServerConfig(serverId)
            if (server?.apiUrl) {
                const client = new PrcClient(server.apiUrl)
                let commandStr = ""

                switch (type) {
                    case "Warn":
                        commandStr = `:warn ${username} ${reason}`
                        break
                    case "Kick":
                        commandStr = `:kick ${username} ${reason}`
                        break
                    case "Ban":
                    case "Ban Bolo":
                        commandStr = `:ban ${username} ${reason}`
                        break
                }

                const promises = []

                if (commandStr) {
                    promises.push(client.executeCommand(commandStr))
                }

                // Send PM for warnings
                if (type === "Warn") {
                    const modName = session.user.robloxUsername || session.user.username || "Staff"
                    const reasonText = reason || "No reason provided"
                    const pmCommand = `:pm ${username} You have been warned by ${modName} for ${reasonText} - Project Overwatch`
                    promises.push(client.executeCommand(pmCommand))
                }

                // Execute all commands in parallel
                await Promise.allSettled(promises)

                // 3. Cross-server ban sync (for bans only) - Removed
                // if (type === "Ban" || type === "Ban Bolo") {
                //     // Sync removed
                // }
            }
        } catch (prcError) {
            // PRC error - still continue, punishment is logged
        }

        revalidatePath(`/dashboard/${serverId}/user/${username}`)
        return { success: true, message: "Punishment issued." }

    } catch (error) {
        return { success: false, message: "Failed to log punishment." }
    }
}

export async function resolvePunishment(punishmentId: string) {
    const session = await getSession()
    if (!session) return { success: false, message: "Unauthorized" }

    try {
        const punishment = await prisma.punishment.findUnique({ where: { id: punishmentId } })
        if (!punishment) return { success: false, message: "Not found" }

        // Require canViewPunishments basline
        const { getUserPermissions } = await import("@/lib/admin")
        const perms = await getUserPermissions(session.user as any, punishment.serverId)

        if (!perms.canViewPunishments) return { success: false, message: "Forbidden: Missing canViewPunishments" }

        if (punishment.type === "Ban Bolo" && !perms.canManageBolos) {
            return { success: false, message: "Forbidden: Missing canManageBolos" }
        }

        await prisma.punishment.update({
            where: { id: punishmentId },
            data: { resolved: true }
        })
        revalidatePath("/dashboard")
        return { success: true }
    } catch (e) {
        return { success: false }
    }
}
