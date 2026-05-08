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
    const quotaPercent = quotaMinutes > 0 ? Math.round((totalMinutes / quotaMinutes) * 100) : 0
    const barWidth = Math.min(100, quotaPercent)
    const isMet = totalMinutes >= quotaMinutes
    const barColor = isMet ? "bg-emerald-500" : "bg-indigo-500"

    return (
        <div className="flex flex-col items-center w-full">
            {startTime && (
                <>
                    <div className="text-3xl font-mono font-bold text-white tracking-widest tabular-nums">
                        {format(hours)}:{format(minutes)}:{format(seconds)}
                    </div>
                    <div className="text-xs text-emerald-400 mt-1 font-bold tracking-wide uppercase mb-4">
                        Current Session
                    </div>
                </>
            )}

            {quotaMinutes > 0 && (
                <div className={`w-full border-t border-white/5 pt-3 space-y-1 ${!startTime ? "mt-0" : ""}`}>
                    <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                            style={{ width: `${barWidth}%` }}
                        ></div>
                    </div>
                    {isMet && (
                        <div className="flex justify-between text-[10px]">
                            <span className="text-emerald-400">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</span>
                            <span className="text-emerald-400 font-medium">{quotaPercent}%</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
