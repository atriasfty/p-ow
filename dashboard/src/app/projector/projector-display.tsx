"use client"

import { useState, useEffect, useCallback } from "react"

interface ProjectorStats {
    platform: {
        totalServers: number
        activeServers: number
        totalMembers: number
        staffOnDuty: number
        activePlayers: number
        logsToday: number
        punishmentsToday: number
        activeModCalls: number
        activeEmergencyCalls: number
    }
    updatedAt: string
}

function useTime() {
    const [time, setTime] = useState<Date | null>(null)
    useEffect(() => {
        setTime(new Date())
        const id = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(id)
    }, [])
    return time
}

function StatCard({
    value,
    label,
    sub,
    alert = false,
}: {
    value: string | number
    label: string
    sub?: string
    alert?: boolean
}) {
    return (
        <div
            className={`flex flex-col justify-between p-8 border transition-colors ${
                alert
                    ? "bg-black border-black"
                    : "bg-white border-black/10"
            }`}
        >
            <span
                className={`text-5xl xl:text-6xl font-bold tracking-tight tabular-nums leading-none ${
                    alert ? "text-white" : "text-black"
                }`}
            >
                {value}
            </span>
            <div className="mt-4">
                <p
                    className={`text-xs font-bold uppercase tracking-[0.2em] ${
                        alert ? "text-white/60" : "text-black/40"
                    }`}
                >
                    {label}
                </p>
                {sub && (
                    <p
                        className={`text-xs mt-0.5 ${
                            alert ? "text-white/40" : "text-black/25"
                        }`}
                    >
                        {sub}
                    </p>
                )}
            </div>
        </div>
    )
}

function Ticker({ lastUpdated }: { lastUpdated: string | null }) {
    const [secs, setSecs] = useState(0)
    useEffect(() => {
        setSecs(0)
        const id = setInterval(() => setSecs((s) => s + 1), 1000)
        return () => clearInterval(id)
    }, [lastUpdated])

    return (
        <span className="text-xs text-black/30 tabular-nums">
            {secs}s ago
        </span>
    )
}

export function ProjectorDisplay() {
    const [stats, setStats] = useState<ProjectorStats | null>(null)
    const [error, setError] = useState(false)
    const [ready, setReady] = useState(false)
    const time = useTime()

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/projector-stats", { cache: "no-store" })
            if (!res.ok) { setError(true); return }
            setStats(await res.json())
            setError(false)
        } catch {
            setError(true)
        } finally {
            setReady(true)
        }
    }, [])

    useEffect(() => {
        fetchStats()
        const id = setInterval(fetchStats, 10_000)
        return () => clearInterval(id)
    }, [fetchStats])

    const fmt = (n: number) => n.toLocaleString("en-US")

    const hasAlerts = stats
        ? stats.platform.activeEmergencyCalls > 0 || stats.platform.activeModCalls > 3
        : false

    return (
        <div className="min-h-screen bg-white text-black flex flex-col select-none overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between px-10 py-6 border-b border-black/10">
                <div className="flex items-center gap-4">
                    <span
                        className={`inline-block h-2 w-2 rounded-full ${
                            hasAlerts ? "bg-red-500 animate-ping" : "bg-black animate-pulse"
                        }`}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-black/30 ml-1">
                        Live
                    </span>
                    <span className="text-lg font-bold tracking-tight">
                        Project Overwatch
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-black/30 border border-black/15 px-2 py-0.5 rounded">
                        Platform Stats
                    </span>
                </div>

                <div className="text-right">
                    {time ? (
                        <>
                            <p className="text-3xl font-bold tabular-nums tracking-tight leading-none">
                                {time.toLocaleTimeString("en-GB")}
                            </p>
                            <p className="text-[10px] uppercase tracking-widest text-black/30 mt-1">
                                {time.toLocaleDateString("en-GB", {
                                    weekday: "long",
                                    day: "2-digit",
                                    month: "long",
                                    year: "numeric",
                                })}
                            </p>
                        </>
                    ) : (
                        <div className="h-8 w-32 bg-black/5 rounded animate-pulse" />
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-10">
                {!ready ? (
                    <div className="h-full flex items-center justify-center">
                        <p className="text-xs uppercase tracking-[0.4em] text-black/20 animate-pulse">
                            Connecting…
                        </p>
                    </div>
                ) : error ? (
                    <div className="h-full flex items-center justify-center">
                        <p className="text-xs uppercase tracking-[0.4em] text-red-400">
                            Failed to load — retrying
                        </p>
                    </div>
                ) : stats ? (
                    <div className="grid grid-cols-3 gap-4 h-full">
                        {/* Row 1 */}
                        <StatCard
                            value={fmt(stats.platform.activePlayers)}
                            label="Active Players"
                            sub="In-game right now"
                            alert={false}
                        />
                        <StatCard
                            value={fmt(stats.platform.staffOnDuty)}
                            label="Staff on Duty"
                            sub="Across all servers"
                            alert={stats.platform.staffOnDuty === 0}
                        />
                        <StatCard
                            value={`${stats.platform.activeServers} / ${stats.platform.totalServers}`}
                            label="Servers Online"
                            sub="Active in last 30s"
                        />

                        {/* Row 2 */}
                        <StatCard
                            value={fmt(stats.platform.totalMembers)}
                            label="Total Members"
                            sub="Platform-wide"
                        />
                        <StatCard
                            value={fmt(stats.platform.logsToday)}
                            label="Logs Today"
                            sub="Since midnight"
                        />
                        <StatCard
                            value={fmt(stats.platform.activeModCalls)}
                            label="Mod Calls"
                            sub="Past hour"
                            alert={stats.platform.activeModCalls > 3}
                        />

                        {/* Row 3 — full-width summary bar */}
                        <div className="col-span-3 border border-black/10 px-8 py-5 flex items-center justify-between">
                            <div className="flex gap-12">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/35">
                                        Punishments Today
                                    </p>
                                    <p className="text-2xl font-bold tabular-nums mt-0.5">
                                        {fmt(stats.platform.punishmentsToday)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/35">
                                        Emergency Calls (1h)
                                    </p>
                                    <p
                                        className={`text-2xl font-bold tabular-nums mt-0.5 ${
                                            stats.platform.activeEmergencyCalls > 0
                                                ? "text-red-600"
                                                : "text-black"
                                        }`}
                                    >
                                        {fmt(stats.platform.activeEmergencyCalls)}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/35 mb-1">
                                    Last Refreshed
                                </p>
                                <Ticker lastUpdated={stats.updatedAt} />
                                <p className="text-[9px] text-black/20 mt-0.5">
                                    Auto-refreshes every 10s
                                </p>
                            </div>
                        </div>
                    </div>
                ) : null}
            </main>

            {/* Footer */}
            <footer className="px-10 py-4 border-t border-black/10 flex items-center justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-black/20">
                    Project Overwatch · Atria Safety · Superadmin View
                </p>
                <p className="text-[9px] uppercase tracking-[0.3em] text-black/15">
                    /projector
                </p>
            </footer>
        </div>
    )
}
