import { REST, Routes, SlashCommandBuilder } from "discord.js"
import { prisma } from "./client"
import dotenv from "dotenv"

dotenv.config()

const commands = [
    // LOA Command
    new SlashCommandBuilder()
        .setName("loa")
        .setDescription("Manage Leave of Absences")
        .addSubcommand((sub: any) =>
            sub.setName("request")
                .setDescription("Request a Leave of Absence")
                .addStringOption((opt: any) =>
                    opt.setName("start_date")
                        .setDescription("Start date (YYYY-MM-DD)")
                        .setRequired(true))
                .addStringOption((opt: any) =>
                    opt.setName("end_date")
                        .setDescription("End date (YYYY-MM-DD)")
                        .setRequired(true))
                .addStringOption((opt: any) =>
                    opt.setName("reason")
                        .setDescription("Reason for LOA")
                        .setRequired(true))
        ),

    // Shift Command
    new SlashCommandBuilder()
        .setName("shift")
        .setDescription("Manage your shift")
        .addSubcommand((sub: any) =>
            sub.setName("start")
                .setDescription("Start a shift")
        )
        .addSubcommand((sub: any) =>
            sub.setName("end")
                .setDescription("End your current shift")
        )
        .addSubcommand((sub: any) =>
            sub.setName("status")
                .setDescription("Check your current shift status")
        ),

    // Quota Command
    new SlashCommandBuilder()
        .setName("quota")
        .setDescription("Check quota statistics")
        .addSubcommand((sub: any) =>
            sub.setName("status")
                .setDescription("Check your quota status across all servers")
        )
        .addSubcommand((sub: any) =>
            sub.setName("leaderboard")
                .setDescription("View global quota leaderboard for all members")
        ),

    // In-game Command
    new SlashCommandBuilder()
        .setName("command")
        .setDescription("Execute an in-game command")
        .addStringOption((opt: any) =>
            opt.setName("cmd")
                .setDescription("Command to execute (e.g. ':announce Hello')")
                .setRequired(true)),

    // Log Punishment Command
    new SlashCommandBuilder()
        .setName("log")
        .setDescription("Log a punishment or view logs")
        .addSubcommand((sub: any) =>
            sub.setName("punishment")
                .setDescription("Log a punishment against a player")
                .addStringOption((opt: any) =>
                    opt.setName("username")
                        .setDescription("Roblox username of the player")
                        .setRequired(true))
                .addStringOption((opt: any) =>
                    opt.setName("type")
                        .setDescription("Type of punishment")
                        .setRequired(true)
                        .addChoices(
                            { name: "Warn", value: "Warn" },
                            { name: "Kick", value: "Kick" },
                            { name: "Ban", value: "Ban" },
                            { name: "Ban Bolo", value: "Ban Bolo" }
                        ))
                .addStringOption((opt: any) =>
                    opt.setName("reason")
                        .setDescription("Reason for punishment")
                        .setRequired(true))
        )
        .addSubcommand((sub: any) =>
            sub.setName("view")
                .setDescription("View logs or punishments for a Roblox user")
                .addStringOption((opt: any) =>
                    opt.setName("username")
                        .setDescription("Roblox username to search for")
                        .setRequired(true))
                .addStringOption((opt: any) =>
                    opt.setName("type")
                        .setDescription("Type of logs to view")
                        .setRequired(true)
                        .addChoices(
                            { name: "All Logs", value: "all" },
                            { name: "Joins/Leaves", value: "join" },
                            { name: "Kills", value: "kill" },
                            { name: "Commands", value: "command" },
                            { name: "Punishments", value: "punishment" }
                        ))
        ),

    // Staff Request Command
    new SlashCommandBuilder()
        .setName("staffrequest")
        .setDescription("Request staff assistance")
        .addStringOption((opt: any) =>
            opt.setName("reason")
                .setDescription("Reason for staff request")
                .setRequired(true)),

    // Server Status Command
    new SlashCommandBuilder()
        .setName("server")
        .setDescription("Server management commands")
        .addSubcommand((sub: any) =>
            sub.setName("status")
                .setDescription("View server status (players, staff, etc.)"))

].map(c => c.toJSON())

export async function deployCommands() {
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!)

    try {
        console.log(`Syncing slash commands globally with Discord... (Client ID: ${process.env.CLIENT_ID || 'MISSING'})`)
        if (process.env.GUILD_ID) console.log(`Guild ID: ${process.env.GUILD_ID}`)

        if (!process.env.CLIENT_ID) {
            console.warn("❌ Missing CLIENT_ID in environment! Command sync aborted.")
            return
        }

        // 1. Global deployment (takes up to 1h to propagate, but works everywhere)
        try {
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            )
            console.log("✓ Global slash commands updated")
        } catch (globalError: any) {
            console.error("❌ Failed to sync global commands:", globalError.message)
        }

        // 2. Sync with specific guild for immediate updates
        if (process.env.GUILD_ID) {
            try {
                console.log(`Syncing guild-specific commands for ${process.env.GUILD_ID}...`)
                await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                    { body: commands }
                )
                console.log("✓ Guild-specific commands updated (instant)")

                // Clear missing permissions flag if it was set
                await (prisma.server as any).updateMany({
                    where: { discordGuildId: process.env.GUILD_ID },
                    data: { botMissingPermissions: false }
                })
            } catch (guildError: any) {
                if (guildError.code === 50001) {
                    console.warn("⚠️ Guild sync failed: 'Missing Access'. Ensure bot has 'applications.commands' scope in this server.")

                    // Set missing permissions flag for dashboard warning
                    await (prisma.server as any).updateMany({
                        where: { discordGuildId: process.env.GUILD_ID },
                        data: { botMissingPermissions: true }
                    })
                } else {
                    console.error("❌ Failed to sync guild commands:", guildError.message)
                }
            }
        }

        console.log("Command synchronization cycle complete.")
    } catch (error) {
        console.error("Unexpected error during sync cycle:", error)
    }
}

// Allow running standalone with: npx ts-node src/deploy-commands.ts
if (require.main === module) {
    deployCommands()
}
