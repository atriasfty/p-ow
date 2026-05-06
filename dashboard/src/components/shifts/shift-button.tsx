import { apiFetch } from "@/lib/api-fetch"
"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useDialog } from "@/components/providers/dialog-provider"
import { useServerEventsContextSafe } from "@/components/providers/server-events-provider"

interface ShiftButtonProps {
    isActive: boolean
    serverId: string
    disabled?: boolean
}

export function ShiftButton({ isActive: initialIsActive, serverId, disabled }: ShiftButtonProps) {
    const [loading, setLoading] = useState(false)
    const [isActive, setIsActive] = useState(initialIsActive)
    const router = useRouter()
    const { showAlert } = useDialog()

    // Keep button in sync with real-time shift state — catches shifts started/ended
    // in-game or via the bot without a page reload.
    const sseState = useServerEventsContextSafe()
    useEffect(() => {
        if (sseState?.shiftStatus !== null && sseState?.shiftStatus !== undefined) {
            setIsActive(!!sseState.shiftStatus.shift)
        }
    }, [sseState?.shiftStatus])

    const toggleShift = async () => {
        setLoading(true)
        try {
            // We use the same pattern as the admin API but for the current user
            // The server-side will use the session user's IDs
            const method = isActive ? "PATCH" : "POST"
            const res = await apiFetch(`/api/shifts/toggle`, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serverId })
            })

            if (res.ok) {
                router.refresh()
            } else {
                const data = await res.json()
                await showAlert("Shift Error", data.error || "Failed to toggle shift", "error")
            }
        } catch (e) {
            console.error("Shift toggle error:", e)
        } finally {
            setLoading(false)
        }
    }

    return (
        <button
            onClick={toggleShift}
            disabled={disabled || loading}
            className={`flex items-center justify-center mx-auto gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg disabled:opacity-50 ${isActive
                    ? "bg-red-500 hover:bg-red-600 text-white shadow-red-900/20"
                    : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-900/20"
                }`}
        >
            {loading && (
                <Loader2 className="h-5 w-5 animate-spin" />
            )}
            {isActive ? "End Shift" : "Start Shift"}
        </button>
    )
}
