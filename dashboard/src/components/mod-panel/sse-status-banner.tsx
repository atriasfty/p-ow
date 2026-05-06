"use client"

import { useServerEventsContextSafe } from "@/components/providers/server-events-provider"
import { WifiOff } from "lucide-react"

export function SseStatusBanner() {
    const ctx = useServerEventsContextSafe()

    if (!ctx || ctx.connected) return null

    return (
        <div className="flex items-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-amber-400 text-xs font-medium animate-in slide-in-from-top-2 duration-300 flex-shrink-0">
            <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Live connection lost — reconnecting…</span>
        </div>
    )
}
