"use client"

import { useState, useEffect, useCallback } from "react"

interface ProjectorStats {
    platform: { totalServers: number; activeServers: number; totalMembers: number; newMembersWeek: number }
    live: { activePlayers: number; staffOnDuty: number; activeLoas: number; modCallsHour: number; emergencyCallsHour: number }
    today: { logs: number; joins: number; leaves: number; kills: number; punishments: number; shiftsStarted: number; shiftDurationSeconds: number; warns: number; kicks: number; bans: number; banBolos: number }
    week: { punishments: number; warns: number; kicks: number; bans: number; banBolos: number }
    db: { totalLogs: number; totalPunishments: number; totalShifts: number }
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

function useTicker(dep: string | null) {
    const [secs, setSecs] = useState(0)
    useEffect(() => {
        setSecs(0)
        const id = setInterval(() => setSecs((s) => s + 1), 1000)
        return () => clearInterval(id)
    }, [dep])
    return secs
}

const fmt = (n: number) => n.toLocaleString("en-US")

const fmtBig = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
    return n.toString()
}

const fmtDuration = (seconds: number) => {
    if (seconds === 0) return "—"
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function Row({
    label,
    value,
    alert = false,
    dim = false,
}: {
    label: string
    value: string | number
    alert?: boolean
    dim?: boolean
}) {
    return (
        <div className="flex items-baseline justify-between py-[3px]">
            <span className={`text-[11px] ${alert ? "text-red-400" : dim ? "text-white/25" : "text-white/50"}`}>
                {label}
            </span>
            <span className={`text-xs font-bold tabular-nums ${alert ? "text-red-400" : dim ? "text-white/30" : "text-white"}`}>
                {value}
            </span>
        </div>
    )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/25 pb-1 mb-1 border-b border-white/8">
            {children}
        </p>
    )
}

function Col({ children }: { children: React.ReactNode }) {
    return <div className="px-5 py-4 flex flex-col gap-4 overflow-hidden">{children}</div>
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <SectionTitle>{title}</SectionTitle>
            <div>{children}</div>
        </div>
    )
}

function BigStat({ value, label, alert = false }: { value: string | number; label: string; alert?: boolean }) {
    return (
        <div className="mb-1">
            <div className={`text-3xl font-bold tabular-nums leading-none ${alert ? "text-red-400" : "text-white"}`}>
                {value}
            </div>
            <div className="text-[10px] text-white/35 uppercase tracking-widest mt-0.5">{label}</div>
        </div>
    )
}

export function ProjectorDisplay() {
    const [stats, setStats] = useState<ProjectorStats | null>(null)
    const [ready, setReady] = useState(false)
    const [error, setError] = useState(false)
    const time = useTime()
    const secs = useTicker(stats?.updatedAt ?? null)

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

    const hasEmergency = (stats?.live.emergencyCallsHour ?? 0) > 0
    const hasManyModCalls = (stats?.live.modCallsHour ?? 0) > 3

    return (
        <div className="h-screen overflow-hidden bg-black text-white flex flex-col">

            {/* ── Header ── */}
            <header className="flex-none flex items-center justify-between px-6 py-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full flex-none ${hasEmergency ? "bg-red-500 animate-ping" : "bg-emerald-400 animate-pulse"}`} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">Live</span>
                    <span className="text-sm font-bold tracking-tight">Project Overwatch</span>
                    <span className="text-[9px] border border-white/20 text-white/30 px-1.5 py-0.5 rounded uppercase tracking-widest">
                        Superadmin
                    </span>
                </div>
                <div className="flex items-center gap-6">
                    {error && <span className="text-[10px] text-red-400 uppercase tracking-widest animate-pulse">Retrying…</span>}
                    {ready && !error && (
                        <span className="text-[10px] text-white/25 tabular-nums">
                            {secs}s ago
                        </span>
                    )}
                    {time && (
                        <>
                            <span className="text-[10px] text-white/30 uppercase tracking-widest">
                                {time.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                            <span className="text-xl font-bold tabular-nums tracking-tight">
                                {time.toLocaleTimeString("en-GB")}
                            </span>
                        </>
                    )}
                </div>
            </header>

            {/* ── Main ── */}
            <main className="flex-1 min-h-0 grid grid-cols-3 divide-x divide-white/8">
                {!ready ? (
                    <div className="col-span-3 flex items-center justify-center">
                        <p className="text-[11px] uppercase tracking-[0.4em] text-white/20 animate-pulse">Connecting…</p>
                    </div>
                ) : !stats ? (
                    <div className="col-span-3 flex items-center justify-center">
                        <p className="text-[11px] uppercase tracking-[0.4em] text-red-400">Failed to load</p>
                    </div>
                ) : (
                    <>
                        {/* ── Col 1 ── */}
                        <Col>
                            <Block title="Platform">
                                <BigStat value={`${stats.platform.activeServers} / ${stats.platform.totalServers}`} label="Servers Online" />
                                <Row label="Total Members" value={fmt(stats.platform.totalMembers)} />
                                <Row label="New Members (7d)" value={fmt(stats.platform.newMembersWeek)} />
                            </Block>

                            <Block title="Punishments · Today">
                                <Row label="Warnings" value={fmt(stats.today.warns)} />
                                <Row label="Kicks" value={fmt(stats.today.kicks)} />
                                <Row label="Bans" value={fmt(stats.today.bans)} alert={stats.today.bans > 0} />
                                <Row label="Ban Bolos" value={fmt(stats.today.banBolos)} alert={stats.today.banBolos > 0} />
                                <Row label="Total" value={fmt(stats.today.punishments)} />
                            </Block>

                            <Block title="Punishments · 7 Days">
                                <Row label="Warnings" value={fmt(stats.week.warns)} />
                                <Row label="Kicks" value={fmt(stats.week.kicks)} />
                                <Row label="Bans" value={fmt(stats.week.bans)} alert={stats.week.bans > 0} />
                                <Row label="Ban Bolos" value={fmt(stats.week.banBolos)} alert={stats.week.banBolos > 0} />
                                <Row label="Total" value={fmt(stats.week.punishments)} />
                            </Block>

                            <Block title="Database Totals">
                                <Row label="Total Logs" value={fmtBig(stats.db.totalLogs)} />
                                <Row label="Total Punishments" value={fmtBig(stats.db.totalPunishments)} />
                                <Row label="Total Shifts" value={fmtBig(stats.db.totalShifts)} />
                            </Block>
                        </Col>

                        {/* ── Col 2 ── */}
                        <Col>
                            <Block title="Live Now">
                                <BigStat value={fmt(stats.live.activePlayers)} label="Players In-Game" />
                                <BigStat value={fmt(stats.live.staffOnDuty)} label="Staff On Duty" />
                                <Row label="Active LOAs" value={fmt(stats.live.activeLoas)} />
                                <Row label="Mod Calls (1h)" value={fmt(stats.live.modCallsHour)} alert={hasManyModCalls} />
                                <Row label="Emergency Calls (1h)" value={fmt(stats.live.emergencyCallsHour)} alert={hasEmergency} />
                            </Block>

                            <Block title="Shifts · Today">
                                <Row label="Shifts Started" value={fmt(stats.today.shiftsStarted)} />
                                <Row label="Currently Active" value={fmt(stats.live.staffOnDuty)} />
                                <Row label="Total Duty Time" value={fmtDuration(stats.today.shiftDurationSeconds)} />
                            </Block>

                            <Block title="Servers">
                                <Row label="Total Registered" value={fmt(stats.platform.totalServers)} />
                                <Row label="Online (30s)" value={fmt(stats.platform.activeServers)} />
                                <Row label="Offline" value={fmt(stats.platform.totalServers - stats.platform.activeServers)} dim />
                            </Block>
                        </Col>

                        {/* ── Col 3 ── */}
                        <Col>
                            <Block title="Activity · Today">
                                <BigStat value={fmt(stats.today.logs)} label="Logs Ingested" />
                                <Row label="Player Joins" value={fmt(stats.today.joins)} />
                                <Row label="Player Leaves" value={fmt(stats.today.leaves)} />
                                <Row label="Kill Logs" value={fmt(stats.today.kills)} />
                                <Row label="Punishments" value={fmt(stats.today.punishments)} />
                                <Row label="Shifts Started" value={fmt(stats.today.shiftsStarted)} />
                            </Block>

                            <Block title="Members">
                                <Row label="Total Platform Members" value={fmt(stats.platform.totalMembers)} />
                                <Row label="New This Week" value={fmt(stats.platform.newMembersWeek)} />
                                <Row label="On LOA Now" value={fmt(stats.live.activeLoas)} />
                            </Block>

                            <Block title="All-Time Records">
                                <Row label="Logs in DB" value={fmtBig(stats.db.totalLogs)} />
                                <Row label="Punishments in DB" value={fmtBig(stats.db.totalPunishments)} />
                                <Row label="Shifts in DB" value={fmtBig(stats.db.totalShifts)} />
                            </Block>
                        </Col>
                    </>
                )}
            </main>

            {/* ── Footer ── */}
            <footer className="flex-none flex items-center justify-between px-6 py-2 border-t border-white/8">
                <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-white/15">
                    Project Overwatch · Atria Safety · /projector
                </span>
                <span className="text-[9px] uppercase tracking-[0.3em] text-white/15">
                    10s auto-refresh
                </span>
            </footer>
        </div>
    )
}
