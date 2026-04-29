"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface PhLatency { avgMs: number; errorRate: number; totalCalls: number }

interface ProjectorStats {
    platform: { totalServers: number; activeServers: number; staleServers: number; totalMembers: number; newMembersWeek: number }
    live: { activePlayers: number; staffOnDuty: number; activeLoas: number; modCallsHour: number; emergencyCallsHour: number }
    today: { logs: number; joins: number; leaves: number; kills: number; punishments: number; shiftsStarted: number; shiftDurationSeconds: number; warns: number; kicks: number; bans: number; banBolos: number }
    week: { punishments: number; warns: number; kicks: number; bans: number; banBolos: number }
    db: { totalLogs: number; totalPunishments: number; totalShifts: number }
    health: { dbLatencyMs: number; lastSyncAgeSeconds: number | null; prcLatency: PhLatency | null; powApiLatency: PhLatency | null; syncHealth: { successRate: number; totalCycles: number } | null; staleServers: number }
    alerts: Record<string, boolean>
    anyAlert: boolean
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
const fmtBig = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n)
const fmtDuration = (s: number) => { if (!s) return "—"; const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m}m` }

// Thresholds: value, [good limit, warn limit] — above warn = red
const latColor = (ms: number) => ms < 500 ? "text-emerald-400" : ms < 2000 ? "text-yellow-400" : "text-red-400"
const errColor = (pct: number) => pct === 0 ? "text-emerald-400" : pct < 10 ? "text-yellow-400" : "text-red-400"
const syncAgeColor = (s: number) => s < 15 ? "text-emerald-400" : s < 45 ? "text-yellow-400" : "text-red-400"
const dbColor = (ms: number) => ms < 50 ? "text-emerald-400" : ms < 200 ? "text-yellow-400" : "text-red-400"
const rateColor = (pct: number) => pct >= 99 ? "text-emerald-400" : pct >= 90 ? "text-yellow-400" : "text-red-400"

function SectionLabel({ children }: { children: React.ReactNode }) {
    return <p className="text-[10px] uppercase tracking-[0.22em] text-white/35 mb-1.5 mt-0.5">{children}</p>
}

function Row({ label, value, color }: { label: string; value: string | number; color?: string }) {
    return (
        <div className="flex items-baseline justify-between py-[2px]">
            <span className="text-[10px] text-white/45">{label}</span>
            <span className={`text-[11px] font-bold tabular-nums ${color ?? "text-white"}`}>{value}</span>
        </div>
    )
}

function Big({ value, label, color }: { value: string | number; label: string; color?: string }) {
    return (
        <div className="mb-2">
            <div className={`text-3xl font-bold tabular-nums leading-none ${color ?? "text-white"}`}>{value}</div>
            <div className="text-[9px] uppercase tracking-widest text-white/30 mt-0.5">{label}</div>
        </div>
    )
}

function Col({ children }: { children: React.ReactNode }) {
    return <div className="px-5 py-4 flex flex-col gap-3 overflow-hidden min-h-0">{children}</div>
}

export function ProjectorDisplay() {
    const [stats, setStats] = useState<ProjectorStats | null>(null)
    const [ready, setReady] = useState(false)
    const [error, setError] = useState(false)
    const [flashing, setFlashing] = useState(false)
    const prevAlertRef = useRef(false)
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

    // Trigger violent flash when alert state newly becomes true
    useEffect(() => {
        const isAlert = stats?.anyAlert ?? false
        if (isAlert && !prevAlertRef.current) {
            setFlashing(true)
            setTimeout(() => setFlashing(false), 5000)
        }
        prevAlertRef.current = isAlert
    }, [stats?.anyAlert])

    const s = stats
    const h = s?.health

    return (
        <div className="h-screen overflow-hidden bg-black text-white flex flex-col relative">

            {/* Violent flash overlay — 0.2s cycle × 25 iterations = 5s */}
            <style>{`@keyframes vflash { 0%,100%{opacity:0} 50%{opacity:.8} }`}</style>
            {flashing && (
                <div
                    className="fixed inset-0 z-50 pointer-events-none bg-red-600"
                    style={{ animation: "vflash 0.2s ease-in-out 25 forwards" }}
                    onAnimationEnd={() => setFlashing(false)}
                />
            )}

            {/* ── Header ── */}
            <header className="flex-none flex items-center justify-between px-6 py-2.5 border-b border-white/8">
                <div className="flex items-center gap-3">
                    <span className={`h-1.5 w-1.5 rounded-full flex-none ${s?.anyAlert ? "bg-red-500 animate-ping" : "bg-emerald-400 animate-pulse"}`} />
                    <span className="text-[9px] font-bold uppercase tracking-[0.35em] text-white/30">Live</span>
                    <span className="text-sm font-bold tracking-tight">Project Overwatch</span>
                    <span className="text-[8px] border border-white/15 text-white/25 px-1.5 py-0.5 rounded uppercase tracking-widest">Superadmin</span>
                    {s?.anyAlert && (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-red-400 animate-pulse ml-2">
                            ● Alert
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-5">
                    {error && <span className="text-[9px] text-red-400 uppercase tracking-widest animate-pulse">Fetch error — retrying</span>}
                    {ready && !error && <span className="text-[10px] text-white/20 tabular-nums">{secs}s ago</span>}
                    {time && (
                        <>
                            <span className="text-[9px] text-white/25 uppercase tracking-widest">
                                {time.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                            <span className="text-lg font-bold tabular-nums tracking-tight">
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
                ) : !s ? (
                    <div className="col-span-3 flex items-center justify-center">
                        <p className="text-[11px] uppercase tracking-[0.4em] text-red-400">Failed to load</p>
                    </div>
                ) : (
                    <>
                        {/* ── Col 1: Platform + Punishments ── */}
                        <Col>
                            <SectionLabel>Platform</SectionLabel>
                            <Big value={`${s.platform.activeServers} / ${s.platform.totalServers}`} label="Servers Online" color={s.platform.staleServers > s.platform.totalServers * 0.5 ? "text-red-400" : "text-white"} />
                            <Row label="Stale / Offline" value={s.platform.staleServers} color={s.platform.staleServers > 0 ? "text-yellow-400" : "text-white"} />
                            <Row label="Total Members" value={fmt(s.platform.totalMembers)} />
                            <Row label="New Members (7d)" value={fmt(s.platform.newMembersWeek)} />

                            <SectionLabel>Punishments · Today</SectionLabel>
                            <Row label="Warnings" value={fmt(s.today.warns)} />
                            <Row label="Kicks" value={fmt(s.today.kicks)} />
                            <Row label="Bans" value={fmt(s.today.bans)} color={s.today.bans > 0 ? "text-red-400" : "text-white"} />
                            <Row label="Ban Bolos" value={fmt(s.today.banBolos)} color={s.today.banBolos > 0 ? "text-red-400" : "text-white"} />
                            <Row label="Total" value={fmt(s.today.punishments)} />

                            <SectionLabel>Punishments · 7 Days</SectionLabel>
                            <Row label="Warnings" value={fmt(s.week.warns)} />
                            <Row label="Kicks" value={fmt(s.week.kicks)} />
                            <Row label="Bans" value={fmt(s.week.bans)} color={s.week.bans > 0 ? "text-red-400" : "text-white"} />
                            <Row label="Ban Bolos" value={fmt(s.week.banBolos)} color={s.week.banBolos > 0 ? "text-red-400" : "text-white"} />
                            <Row label="Total" value={fmt(s.week.punishments)} />
                        </Col>

                        {/* ── Col 2: Live + Shifts + Members ── */}
                        <Col>
                            <SectionLabel>Live Now</SectionLabel>
                            <Big value={fmt(s.live.activePlayers)} label="Players In-Game" />
                            <Big value={fmt(s.live.staffOnDuty)} label="Staff On Duty" color={s.live.staffOnDuty === 0 && s.platform.activeServers > 0 ? "text-yellow-400" : "text-white"} />
                            <Row label="Active LOAs" value={fmt(s.live.activeLoas)} />
                            <Row label="Mod Calls (1h)" value={fmt(s.live.modCallsHour)} color={s.alerts.highModCalls ? "text-red-400" : "text-white"} />
                            <Row label="Emergency Calls (1h)" value={fmt(s.live.emergencyCallsHour)} color={s.alerts.emergencyActive ? "text-red-400" : "text-white"} />

                            <SectionLabel>Shifts · Today</SectionLabel>
                            <Row label="Shifts Started" value={fmt(s.today.shiftsStarted)} />
                            <Row label="Currently Active" value={fmt(s.live.staffOnDuty)} />
                            <Row label="Total Duty Time" value={fmtDuration(s.today.shiftDurationSeconds)} />

                            <SectionLabel>All-Time</SectionLabel>
                            <Row label="Total Logs in DB" value={fmtBig(s.db.totalLogs)} />
                            <Row label="Total Punishments" value={fmtBig(s.db.totalPunishments)} />
                            <Row label="Total Shifts" value={fmtBig(s.db.totalShifts)} />
                        </Col>

                        {/* ── Col 3: Activity + System Health ── */}
                        <Col>
                            <SectionLabel>Activity · Today</SectionLabel>
                            <Big value={fmt(s.today.logs)} label="Logs Ingested" />
                            <Row label="Player Joins" value={fmt(s.today.joins)} />
                            <Row label="Player Leaves" value={fmt(s.today.leaves)} />
                            <Row label="Kill Logs" value={fmt(s.today.kills)} />
                            <Row label="Punishments" value={fmt(s.today.punishments)} />
                            <Row label="Shifts Started" value={fmt(s.today.shiftsStarted)} />

                            <SectionLabel>System Health</SectionLabel>
                            <Row
                                label="DB Latency"
                                value={`${h?.dbLatencyMs ?? "—"}ms`}
                                color={h?.dbLatencyMs !== undefined ? dbColor(h.dbLatencyMs) : "text-white/40"}
                            />
                            <Row
                                label="Last Sync"
                                value={h?.lastSyncAgeSeconds !== null && h?.lastSyncAgeSeconds !== undefined ? `${h.lastSyncAgeSeconds}s ago` : "unknown"}
                                color={h?.lastSyncAgeSeconds !== null && h?.lastSyncAgeSeconds !== undefined ? syncAgeColor(h.lastSyncAgeSeconds) : "text-white/40"}
                            />
                            <Row
                                label="Stale Servers"
                                value={h?.staleServers ?? "—"}
                                color={h?.staleServers === 0 ? "text-emerald-400" : h?.staleServers !== undefined && h.staleServers < s.platform.totalServers * 0.5 ? "text-yellow-400" : "text-red-400"}
                            />
                            <Row
                                label="PRC Avg (5m)"
                                value={h?.prcLatency ? `${h.prcLatency.avgMs}ms` : "—"}
                                color={h?.prcLatency ? latColor(h.prcLatency.avgMs) : "text-white/30"}
                            />
                            <Row
                                label="PRC Error Rate (5m)"
                                value={h?.prcLatency ? `${h.prcLatency.errorRate}%` : "—"}
                                color={h?.prcLatency ? errColor(h.prcLatency.errorRate) : "text-white/30"}
                            />
                            <Row
                                label="PRC Calls (5m)"
                                value={h?.prcLatency ? fmt(h.prcLatency.totalCalls) : "—"}
                                color="text-white/70"
                            />
                            <Row
                                label="POW API Avg (5m)"
                                value={h?.powApiLatency ? `${h.powApiLatency.avgMs}ms` : "—"}
                                color={h?.powApiLatency ? latColor(h.powApiLatency.avgMs) : "text-white/30"}
                            />
                            <Row
                                label="POW API Errors (5m)"
                                value={h?.powApiLatency ? `${h.powApiLatency.errorRate}%` : "—"}
                                color={h?.powApiLatency ? errColor(h.powApiLatency.errorRate) : "text-white/30"}
                            />
                            <Row
                                label="Sync Success (5m)"
                                value={h?.syncHealth ? `${h.syncHealth.successRate}%` : "—"}
                                color={h?.syncHealth ? rateColor(h.syncHealth.successRate) : "text-white/30"}
                            />
                            <Row
                                label="Sync Cycles (5m)"
                                value={h?.syncHealth ? fmt(h.syncHealth.totalCycles) : "—"}
                                color="text-white/70"
                            />
                        </Col>
                    </>
                )}
            </main>

            {/* ── Footer ── */}
            <footer className="flex-none flex items-center justify-between px-6 py-1.5 border-t border-white/8">
                <span className="text-[8px] font-semibold uppercase tracking-[0.3em] text-white/12">
                    Project Overwatch · Atria Safety · /projector
                </span>
                <span className="text-[8px] uppercase tracking-[0.3em] text-white/12">
                    10s auto-refresh
                </span>
            </footer>
        </div>
    )
}
