"use client"


import { useUser, UserButton } from "@clerk/nextjs"
import { ConnectionRequirementScreen } from "@/components/auth/connection-requirement-screen"

export function EnsureConnections({ children }: { children: React.ReactNode }) {
    const { user, isLoaded } = useUser()

    // Render optimistically while Clerk loads: signed-out visitors (the common
    // case on public pages) would otherwise stare at a blank loading screen,
    // and a Clerk outage would take down the whole site. The connection
    // requirement below still kicks in as soon as a signed-in user resolves.
    if (!isLoaded) return <>{children}</>
    if (!user) return <>{children}</>

    // Check for discord account in external accounts
    // Using includes() to avoid TypeScript strict type comparison issues
    const discordProviders = ["discord", "oauth_discord"]
    const discordAccount = user.externalAccounts.find(
        (a) => discordProviders.includes(a.provider)
    )

    // Check for roblox account in external accounts  
    const robloxProviders = ["roblox", "oauth_roblox", "oauth_custom_roblox", "custom_roblox"]
    const robloxAccount = user.externalAccounts.find(
        (a) => robloxProviders.includes(a.provider)
    )

    const missingDiscord = !discordAccount
    const missingRoblox = !robloxAccount

    if (missingDiscord || missingRoblox) {
        const missing = []
        if (missingDiscord) missing.push("Discord")
        if (missingRoblox) missing.push("Roblox")

        return (
            <ConnectionRequirementScreen
                missing={missing}
                discordUsername={discordAccount?.username}
                robloxUsername={robloxAccount?.username}
            />
        )
    }

    return <>{children}</>
}

// Re-export with legacy name for backwards compatibility
export { EnsureConnections as EnsureDiscordConnection }
