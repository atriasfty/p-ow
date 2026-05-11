"use client"

import { useEffect, useState } from "react"

interface UseDiscordRoleSyncProps {
    serverId: string
    enabled?: boolean
}

export function useDiscordRoleSync({ serverId, enabled = true }: UseDiscordRoleSyncProps) {
    const [synced, setSynced] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!enabled || synced) return

        const sync = async () => {
            try {
                // Step 1: Always link Discord ID to member record
                const linkRes = await fetch("/api/discord/link", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-csrf-check": "1"
                    },
                    body: JSON.stringify({ serverId })
                })

                if (linkRes.ok) {
                    console.log("Discord ID linked to member record")
                }

                // Step 2: Try auto-assign roles (optional - may fail if not configured)
                await fetch("/api/discord/auto-assign", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-csrf-check": "1"
                    },
                    body: JSON.stringify({ serverId })
                }).catch(() => { }) // Ignore errors

                setSynced(true)
            } catch (e) {
                console.error("Discord sync failed:", e)
                setError("Failed to sync Discord")
            }
        }

        sync()
    }, [serverId, enabled, synced])

    return { synced, error }
}
