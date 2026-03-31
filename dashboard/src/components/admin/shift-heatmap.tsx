"use client"

import React, { useEffect, useState, useMemo } from "react"
import { Loader2, Info } from "lucide-react"

interface HeatmapData {
    date: string
    value: number
}

interface ShiftHeatmapProps {
    serverId: string
    userId: string
    userName: string
}

export function ShiftHeatmap({ serverId, userId, userName }: ShiftHeatmapProps) {
    const [data, setData] = useState<HeatmapData[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchHeatmap() {
            setLoading(true)
            try {
                const res = await fetch(`/api/admin/members/${userId}/heatmap?serverId=${serverId}`)
                if (res.ok) {
                    const json = await res.json()
                    setData(json)
                }
            } catch (e) {
                console.error("Failed to fetch heatmap:", e)
            } finally {
                setLoading(false)
            }
        }
        fetchHeatmap()
    }, [serverId, userId])

    const days = useMemo(() => {
        const result = []
        const today = new Date()
        for (let i = 364; i >= 0; i--) {
            const d = new Date(today)
            d.setDate(d.getDate() - i)
            const dateStr = d.toISOString().split("T")[0]
            const match = data.find(item => item.date === dateStr)
            result.push({
                date: dateStr,
                value: match ? match.value : 0,
                dayOfWeek: d.getDay()
            })
        }
        return result
    }, [data])

    // Group into weeks
    const weeks = useMemo(() => {
        const w: any[] = []
        let currentWeek: any[] = []

        days.forEach((day, i) => {
            currentWeek.push(day)
            if (day.dayOfWeek === 6 || i === days.length - 1) {
                w.push(currentWeek)
                currentWeek = []
            }
        })
        return w
    }, [days])

    const getColor = (minutes: number) => {
        if (minutes === 0) return "bg-zinc-800/50"
        if (minutes < 30) return "bg-indigo-900/40"
        if (minutes < 60) return "bg-indigo-700/60"
        if (minutes < 120) return "bg-indigo-500/80"
        return "bg-indigo-400"
    }

    if (loading) {
        return (
            <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    Shift Activity Heatmap
                    <div className="group relative">
                        <Info className="h-3 w-3 text-zinc-500" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black border border-[#333] rounded text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            Shows daily on-duty time in minutes for the last 365 days.
                        </div>
                    </div>
                </h4>
                <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <span>Less</span>
                    <div className="w-2 h-2 rounded-sm bg-zinc-800/50" />
                    <div className="w-2 h-2 rounded-sm bg-indigo-900/40" />
                    <div className="w-2 h-2 rounded-sm bg-indigo-700/60" />
                    <div className="w-2 h-2 rounded-sm bg-indigo-500/80" />
                    <div className="w-2 h-2 rounded-sm bg-indigo-400" />
                    <span>More</span>
                </div>
            </div>

            <div className="overflow-x-auto pb-2 no-scrollbar">
                <div className="flex gap-[3px] min-w-max">
                    {weeks.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-[3px]">
                            {/* Empty spacers for first week if it doesn't start on Sunday */}
                            {wi === 0 && week.length < 7 && Array.from({ length: 7 - week.length }).map((_, i) => (
                                <div key={`spacer-${i}`} className="w-[10px] h-[10px]" />
                            ))}
                            {week.map((day: any) => (
                                <div
                                    key={day.date}
                                    className={`w-[10px] h-[10px] rounded-[1px] ${getColor(day.value)} transition-colors hover:ring-1 hover:ring-white/20`}
                                    title={`${day.date}: ${day.value} minutes`}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-between text-[10px] text-zinc-500 px-1 italic">
                <span>{new Date(days[0].date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                <span>Today</span>
            </div>
        </div>
    )
}
