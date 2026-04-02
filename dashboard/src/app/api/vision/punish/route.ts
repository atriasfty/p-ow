import { NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { prisma } from "@/lib/db"
import { PrcClient } from "@/lib/prc"
import { getServerConfig } from "@/lib/server-config"
import { verifyVisionSignature, getVisionCorsHeaders } from "@/lib/vision-auth"

export async function OPTIONS(req: Request) {
    return NextResponse.json({}, { headers: getVisionCorsHeaders(req) })
}

export async function POST(req: Request) {
    try {
        // Validate required environment variable
        if (!process.env.VISION_JWT_SECRET) {
            console.error("[Vision Punish] VISION_JWT_SECRET is not set!")
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500, headers: getVisionCorsHeaders(req) }
            )
        }

        const VISION_SECRET = new TextEncoder().encode(process.env.VISION_JWT_SECRET)

        // 1. Verify HMAC signature
        const signature = req.headers.get("X-Vision-Sig")
        if (!verifyVisionSignature(signature)) {
            return NextResponse.json(
                { error: "Unauthorized - Invalid Signature" },
                { status: 403, headers: getVisionCorsHeaders(req) }
            )
        }

        // 2. Verify JWT token
        const authHeader = req.headers.get("Authorization")
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "No token provided" }, { status: 401, headers: getVisionCorsHeaders(req) })
        }

        const token = authHeader.substring(7)
        let payload: any
        try {
            const result = await jwtVerify(token, VISION_SECRET, {
                issuer: "pow-dashboard",
                audience: "pow-vision"
            })
            payload = result.payload
        } catch {
            return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: getVisionCorsHeaders(req) })
        }

        // 3. Parse request body
        const body = await req.json()
        const { playerId, playerUsername, type, reason, serverId: requestedServerId } = body

        if (!playerId || !playerUsername || !type || !reason) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: getVisionCorsHeaders(req) })
        }

        const validTypes = ["Warn", "Kick", "Ban", "Ban Bolo"]
        if (!validTypes.includes(type)) {
            return NextResponse.json({ error: "Invalid punishment type" }, { status: 400, headers: getVisionCorsHeaders(req) })
        }

        // 4. Determine server - use requested or find user's server membership
        let serverId = requestedServerId

        // Import permissions validation
        const { isServerMember, getUserPermissions } = await import("@/lib/admin")

        if (!serverId) {
            // Find user's first server membership
            const member = await prisma.member.findFirst({
                where: { userId: payload.userId },
                select: { serverId: true }
            })
            if (!member) {
                return NextResponse.json({ error: "No server membership found" }, { status: 400, headers: getVisionCorsHeaders(req) })
            }
            serverId = member.serverId
        } else {
            // Explicitly verify the user has access to the requested server
            const hasAccess = await isServerMember({ id: payload.userId } as any, serverId)
            if (!hasAccess) {
                return NextResponse.json({ error: "Forbidden: Not a member of this server" }, { status: 403, headers: getVisionCorsHeaders(req) })
            }
        }

        // Verify action-specific permissions
        const perms = await getUserPermissions({ id: payload.userId } as any, serverId)
        if (type === "Warn" && !perms.canIssueWarnings) {
            return NextResponse.json({ error: "Forbidden: Missing canIssueWarnings permission" }, { status: 403, headers: getVisionCorsHeaders(req) })
        }
        if (type === "Kick" && !perms.canKick) {
            return NextResponse.json({ error: "Forbidden: Missing canKick permission" }, { status: 403, headers: getVisionCorsHeaders(req) })
        }
        if (type === "Ban" && !perms.canBan) {
            return NextResponse.json({ error: "Forbidden: Missing canBan permission" }, { status: 403, headers: getVisionCorsHeaders(req) })
        }
        if (type === "Ban Bolo" && !perms.canBanBolo) {
            return NextResponse.json({ error: "Forbidden: Missing canBanBolo permission" }, { status: 403, headers: getVisionCorsHeaders(req) })
        }

        // 5. Log punishment to database
        const moderatorId = payload.robloxId || payload.discordId || payload.userId
        const punishment = await prisma.punishment.create({
            data: {
                serverId,
                moderatorId,
                userId: String(playerId),
                type,
                reason,
                resolved: type === "Ban Bolo" ? false : true
            }
        })

        // 6. Execute PRC command
        let commandExecuted = false
        try {
            const server = await getServerConfig(serverId)
            if (server?.apiUrl) {
                const client = new PrcClient(server.apiUrl)
                let commandStr = ""

                // Escape double quotes in player name and reason for PRC command safety
                const safeName = playerUsername.replace(/"/g, '\\"')
                const safeReason = reason.replace(/"/g, '\\"')
                const quotedName = safeName.includes(" ") ? `"${safeName}"` : safeName

                switch (type) {
                    case "Warn":
                        commandStr = `:warn ${quotedName} ${safeReason}`
                        break
                    case "Kick":
                        commandStr = `:kick ${quotedName} ${safeReason}`
                        break
                    case "Ban":
                    case "Ban Bolo":
                        commandStr = `:ban ${quotedName} ${safeReason}`
                        break
                }

                const promises: Promise<any>[] = []

                if (commandStr) {
                    promises.push(client.executeCommand(commandStr))
                }

                // Send PM for warnings
                if (type === "Warn") {
                    const modName = payload.robloxUsername || payload.username || "Staff"
                    const safeModName = modName.replace(/"/g, '\\"')
                    const pmCommand = `:pm ${quotedName} You have been warned by ${safeModName} for ${safeReason} - Project Overwatch`
                    promises.push(client.executeCommand(pmCommand))
                }

                await Promise.allSettled(promises)
                commandExecuted = true

                // Cross-server ban sync - Removed
                // if (type === "Ban" || type === "Ban Bolo") {
                //    // Sync removed
                // }
            }
        } catch (prcError) {
            console.error("[Vision Punish] PRC command failed:", prcError)
            // Continue - punishment is logged even if command fails
        }

        // 7. Trigger automation (non-blocking)
        try {
            const { AutomationEngine } = await import("@/lib/automation-engine")
            const context = {
                serverId,
                player: { name: playerUsername, id: String(playerId) },
                punishment: {
                    type,
                    reason,
                    issuer: payload.robloxUsername || payload.username || "Vision User",
                    target: playerUsername
                }
            }

            AutomationEngine.trigger("PUNISHMENT_ISSUED", context)
            if (type === "Warn") AutomationEngine.trigger("WARN_ISSUED", context)
            else if (type === "Kick") AutomationEngine.trigger("KICK_ISSUED", context)
            else if (type.startsWith("Ban")) AutomationEngine.trigger("BAN_ISSUED", context)
        } catch (e) {
            console.error("[Vision Punish] Automation trigger failed:", e)
        }

        return NextResponse.json({
            success: true,
            punishmentId: punishment.id,
            commandExecuted,
            message: `${type} issued successfully`
        }, { headers: getVisionCorsHeaders(req) })

    } catch (error) {
        console.error("[Vision Punish] Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: getVisionCorsHeaders(req) })
    }
}
