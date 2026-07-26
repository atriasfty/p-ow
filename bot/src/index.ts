import http from "http"
import { client, prisma } from "./client"
import { Events, Interaction, MessageFlags } from "discord.js"
import { handleLoaCommand } from "./commands/loa"
import { handleShiftCommand } from "./commands/shift"
import { handleQuotaCommand } from "./commands/quota"
import { handleIngameCommand } from "./commands/ingame"
import { handlePunishCommand } from "./commands/punish"
import { handleStaffRequestCommand } from "./commands/staffrequest"
import { startBotQueueService } from "./services/bot-queue"
import { startLogSyncService } from "./services/log-sync"
import { startAutoRoleSync } from "./services/role-sync"
import { startServerCleanupJob } from "./services/server-cleanup"
import { deployCommands } from "./deploy-commands"
import { sendAlert } from "./lib/alerting"

// --- Process-level crash reporting ---
// A rejected promise with no handler used to kill the process silently and
// leave PM2 restart-looping with no trace. Report, then let PM2 restart us.
process.on("unhandledRejection", (reason: any) => {
    console.error("[FATAL] unhandledRejection:", reason)
    sendAlert({
        key: "bot:unhandledRejection",
        title: "Bot unhandled rejection",
        message: `\`\`\`${(reason?.stack || String(reason)).slice(0, 1500)}\`\`\``,
        severity: "critical",
    })
})

process.on("uncaughtException", (err) => {
    console.error("[FATAL] uncaughtException:", err)
    sendAlert({
        key: "bot:uncaughtException",
        title: "Bot uncaught exception — process exiting",
        message: `\`\`\`${(err.stack || err.message).slice(0, 1500)}\`\`\``,
        severity: "critical",
        cooldownMs: 0,
    })
    // Give the webhook a moment to send, then exit so PM2 restarts us clean
    setTimeout(() => process.exit(1), 2000)
})

client.once(Events.ClientReady, async (c: any) => {
    console.log(`Ready! Logged in as ${c.user?.tag || 'Bot'}`)

    // Sync slash commands with Discord
    console.log("Initializing command sync...")
    await deployCommands().catch(err => console.error("DEPLOY ERROR:", err))

    // Start auto role sync service
    startAutoRoleSync(client, prisma)

    // Start bot queue service (Messages/DMs)
    startBotQueueService(client, prisma)

    // Start log sync service (Poll dashboard for PRC logs)
    startLogSyncService(client)

    // Start automated server cleanup (PRC 24h Deletion Policy)
    startServerCleanupJob()

    sendAlert({
        key: "bot:ready",
        title: "Bot online",
        message: `Logged in as ${c.user?.tag || "Bot"} — ${client.guilds.cache.size} guild(s).`,
        severity: "info",
        cooldownMs: 5 * 60 * 1000, // quiet rapid restart loops
    })
})

// Gateway connection loss — the bot process stays alive but stops doing
// anything useful (no commands, no log sync driver).
client.on(Events.ShardDisconnect, (event) => {
    console.error(`[GATEWAY] Disconnected (code ${event.code})`)
    sendAlert({
        key: "bot:gateway-disconnect",
        title: "Bot disconnected from Discord gateway",
        message: `Close code ${event.code}. Log syncing and slash commands are down until it reconnects.`,
        severity: "critical",
    })
})

client.on(Events.ShardResume, () => {
    console.log("[GATEWAY] Resumed")
})

client.on(Events.Error, (err) => {
    console.error("[CLIENT] Error:", err)
    sendAlert({
        key: "bot:client-error",
        title: "Discord client error",
        message: `\`\`\`${(err.stack || err.message).slice(0, 1500)}\`\`\``,
        severity: "warning",
    })
})

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (interaction.isButton()) {
        const { handleButtonInteraction } = await import("./events/interaction-buttons")
        await handleButtonInteraction(interaction)
        return
    }

    if (interaction.isModalSubmit()) {
        const { handleModalSubmitInteraction } = await import("./events/interaction-buttons")
        await handleModalSubmitInteraction(interaction)
        return
    }

    // Handle Autocomplete for 'server' option
    if (interaction.isAutocomplete()) {
        try {
            const focused = interaction.options.getFocused(true)
            if (focused.name === "server") {
                const query = focused.value.toLowerCase()

                // Get all servers, then filter in JS (SQLite contains is case-sensitive)
                const allServers = await prisma.server.findMany({ take: 25 })

                // Filter by query if not empty
                const servers = query
                    ? allServers.filter((s: any) =>
                        s.name.toLowerCase().includes(query) ||
                        (s.customName && s.customName.toLowerCase().includes(query))
                    )
                    : allServers

                const options = servers.map((s: { id: string; name: string; customName: string | null }) => ({
                    name: s.customName || s.name,
                    value: s.id
                }))

                // Add 'All Servers' option for LOA command only
                if (interaction.commandName === "loa") {
                    options.unshift({ name: "Global (All Servers)", value: "all" })
                }

                // Limit to 25 choices (Discord limit)
                await interaction.respond(options.slice(0, 25))
            } else {
                // Respond with empty array for unknown focused options
                await interaction.respond([])
            }
        } catch (error) {
            console.error("[AUTOCOMPLETE] Error:", error)
            try {
                await interaction.respond([])
            } catch (e) {
                // Already responded or timed out
            }
        }
        return
    }

    if (!interaction.isChatInputCommand()) return

    try {
        switch (interaction.commandName) {
            case "loa":
                await handleLoaCommand(interaction)
                break
            case "shift":
                await handleShiftCommand(interaction)
                break
            case "quota":
                await handleQuotaCommand(interaction)
                break
            case "command":
                await handleIngameCommand(interaction)
                break
            case "log":
                await handlePunishCommand(interaction)
                break
            case "staffrequest":
                await handleStaffRequestCommand(interaction)
                break
            case "server":
                const { handleServerCommand } = await import("./commands/server")
                await handleServerCommand(interaction)
                break
            default:
                break
        }
    } catch (e) {
        console.error("Command error:", e)
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: "There was an error executing this command!", flags: [MessageFlags.Ephemeral] })
        } else {
            await interaction.reply({ content: "There was an error executing this command!", flags: [MessageFlags.Ephemeral] })
        }
    }
})

// Handle Bot removed from server (PRC Policy: 24h grace period then delete)
client.on(Events.GuildDelete, async (guild) => {
    console.log(`⚠️ Bot kicked/left guild: ${guild.name} (${guild.id})`)
    const gracePeriod = new Date()
    gracePeriod.setHours(gracePeriod.getHours() + 24)

    try {
        await (prisma.server as any).updateMany({
            where: { discordGuildId: guild.id },
            data: { deletionScheduledAt: gracePeriod }
        })
        console.log(`🕒 Server ${guild.name} marked for deletion in 24h.`)
    } catch (error) {
        console.error("Failed to schedule server deletion:", error)
    }
})

// Handle Bot added to server (Cancel deletion if scheduled)
client.on(Events.GuildCreate, async (guild) => {
    console.log(`✅ Bot joined guild: ${guild.name} (${guild.id})`)
    try {
        await (prisma.server as any).updateMany({
            where: { discordGuildId: guild.id },
            data: { deletionScheduledAt: null }
        })
        console.log(`✨ Server ${guild.name} deletion canceled.`)
    } catch (error) {
        console.error("Failed to cancel server deletion:", error)
    }
})

// Health check server — reports gateway status, DB reachability and
// outbound queue backlog instead of an unconditional ok.
const healthPort = parseInt(process.env.BOT_HEALTH_PORT || "41732")
http.createServer(async (req, res) => {
    if (req.url === "/health") {
        const checks: Record<string, any> = {}
        let ok = true

        // Discord gateway: 0 = READY
        const wsStatus = client.ws.status
        checks.gateway = { ok: wsStatus === 0, status: wsStatus, pingMs: client.ws.ping }
        if (wsStatus !== 0) ok = false

        try {
            const oldestPending = await prisma.botQueue.findFirst({
                where: { status: "PENDING" },
                orderBy: { createdAt: "asc" },
                select: { createdAt: true },
            })
            const pendingCount = await prisma.botQueue.count({ where: { status: "PENDING" } })
            const oldestAgeSec = oldestPending
                ? Math.round((Date.now() - oldestPending.createdAt.getTime()) / 1000)
                : 0
            // Queue is processed every few seconds — a minutes-old backlog means it's stuck
            checks.queue = { ok: oldestAgeSec < 120, pending: pendingCount, oldestAgeSec }
            checks.db = { ok: true }
            if (oldestAgeSec >= 120) ok = false
        } catch (e: any) {
            checks.db = { ok: false, error: e.message }
            ok = false
        }

        checks.process = {
            uptimeSec: Math.round(process.uptime()),
            rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
            guilds: client.guilds.cache.size,
        }

        res.writeHead(ok ? 200 : 503, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok, service: "pow-bot", checks }))
        return
    }
    res.writeHead(404)
    res.end()
}).listen(healthPort, () => {
    console.log(`Health server listening on port ${healthPort}`)
})

// Login
if (!process.env.DISCORD_TOKEN) {
    console.error("Missing DISCORD_TOKEN")
    process.exit(1)
}
client.login(process.env.DISCORD_TOKEN)
