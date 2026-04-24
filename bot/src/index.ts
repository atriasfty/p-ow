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

// Login
if (!process.env.DISCORD_TOKEN) {
    console.error("Missing DISCORD_TOKEN")
    process.exit(1)
}
client.login(process.env.DISCORD_TOKEN)
