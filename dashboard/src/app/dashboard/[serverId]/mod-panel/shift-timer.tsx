"use client"

import { useEffect, useState } from "react"
import { usePermissions } from "@/components/auth/role-sync-wrapper"
import { useServerEventsContext } from "@/components/providers/server-events-provider"

interface ShiftTimerProps {
    serverId: string
    initialStartTime: Date | null
    quotaMinutes?: number
    weeklyMinutes?: number
}

export function ShiftTimer({ serverId, initialStartTime, quotaMinutes: propQuotaMinutes = 0, weeklyMinutes = 0 }: ShiftTimerProps) {
    // Prefer quota from context (set by RoleSyncWrapper after auto-assign) over prop
    const { quotaMinutes: contextQuotaMinutes } = usePermissions()
    const quotaMinutes = contextQuotaMinutes || propQuotaMinutes

    const [startTime, setStartTime] = useState<Date | null>(initialStartTime)
    const [elapsed, setElapsed] = useState(0)

    // Listen for shift-status events from SSE instead of polling every second
    const { shiftStatus } = useServerEventsContext()
    useEffect(() => {
        if (shiftStatus !== null) {
            setStartTime(shiftStatus.shift?.startTime ? new Date(shiftStatus.shift.startTime) : null)
        }
    }, [shiftStatus])

    // Update elapsed time every second — pure client-side, no network needed
    useEffect(() => {
        if (!startTime) {
            setElapsed(0)
            return
        }

        const tick = () => {
            const diff = Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 1000))
            setElapsed(diff)
        }

        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [startTime])

    const hours = Math.floor(elapsed / 3600)
    const minutes = Math.floor((elapsed % 3600) / 60)
    const seconds = elapsed % 60
    const format = (n: number) => n.toString().padStart(2, "0")

    // Real-time Quota Calc
    const sessionMinutes = Math.floor(elapsed / 60)
    const totalMinutes = weeklyMinutes + sessionMinutes
    const percent = quotaMinutes > 0 ? Math.min(100, Math.round((totalMinutes / quotaMinutes) * 100)) : 0

    if (!startTime) {
        return <div className="text-zinc-500 text-sm">Not on shift</div>
    }

    return (
        <div className="flex flex-col items-center w-full">
            <div className="text-3xl font-mono font-bold text-white tracking-widest tabular-nums">
                {format(hours)}:{format(minutes)}:{format(seconds)}
            </div>
            <div className="text-xs text-emerald-400 mt-1 font-bold tracking-wide uppercase mb-4">
                Current Session
            </div>

            {quotaMinutes > 0 && (
                <div className="w-full border-t border-white/5 pt-3">
                    <div className="flex justify-between items-center mb-1 text-xs">
                        <span className="text-zinc-400">Quota Progress</span>
                        <span className={percent >= 100 ? "text-emerald-400" : "text-zinc-300"}>
                            {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m / {Math.floor(quotaMinutes / 60)}h {quotaMinutes % 60}m
                        </span>
                    </div>
                    <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ${percent >= 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
                            style={{ width: `${percent}%` }}
                        ></div>
                    </div>
                    <div className="text-[10px] text-right mt-1">
                        <span className={percent >= 100 ? "text-emerald-400 font-medium" : "text-zinc-500"}>
                            {percent}% {percent >= 100 ? "✓" : ""}
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}
