"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
    Clock,
    FileText,
    Filter,
    LayoutGrid,
    Lock,
    LogOut,
    Map,
    ScrollText,
    Search,
    Shield,
    Star,
    Sword,
    Terminal,
    Truck,
    User,
    Users,
    Wrench,
} from "lucide-react"

// Styled after the real mod panel (player-list.tsx / log-viewer.tsx):
// bg-[#222] rows, indigo left border on logs, emerald joins, red kills,
// amber commands, callsign badges, postal/street subtitles, team icons.
// Names and events are illustrative samples, not real player data.

const SIDEBAR_ICONS = [LayoutGrid, Users, Clock, Map, FileText, Wrench]

type SamplePlayer = {
    callsign?: string
    name: string
    postal?: string
    sub: string
    team?: "police" | "sheriff" | "dot"
}

const PLAYERS: SamplePlayer[] = [
    { callsign: "1A-12", name: "Officer_Vale", postal: "281", sub: "Palm Avenue", team: "police" },
    { callsign: "3S-04", name: "Quartz_Hawk", postal: "104", sub: "Route 8", team: "sheriff" },
    { name: "MapleDrift", sub: "Civilian" },
    { callsign: "T-22", name: "Cedar_Wolfe", postal: "440", sub: "Industrial Row", team: "dot" },
    { name: "Astro_Venn", sub: "Civilian" },
    { callsign: "1K-07", name: "Onyx_Marlow", postal: "017", sub: "Harbor Loop", team: "police" },
]

type SampleLog =
    | { kind: "join"; name: string }
    | { kind: "leave"; name: string }
    | { kind: "kill"; killer: string; victim: string }
    | { kind: "command"; name: string; cmd: string }

const LOGS: SampleLog[] = [
    { kind: "join", name: "NovaPine" },
    { kind: "command", name: "Officer_Vale", cmd: ":m Patrol briefing in 5" },
    { kind: "kill", killer: "Static_Finch", victim: "MapleDrift" },
    { kind: "join", name: "Juniper_Rex" },
    { kind: "command", name: "Quartz_Hawk", cmd: ":h Welcome to Liberty County!" },
    { kind: "leave", name: "Bl0ck_Runner" },
    { kind: "kill", killer: "Cedar_Wolfe", victim: "Astro_Venn" },
    { kind: "command", name: "Onyx_Marlow", cmd: ":pm NovaPine drive safe" },
    { kind: "join", name: "Static_Finch" },
    { kind: "leave", name: "Juniper_Rex" },
]

// Deterministic pseudo-timestamps (no Date.now: keeps SSR/CSR renders identical).
function stamp(id: number) {
    const m = (14 + Math.floor(id / 9)) % 24
    const s = (id * 7) % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function TeamBadge({ team }: { team?: SamplePlayer["team"] }) {
    if (!team) return null
    return (
        <span className="absolute -bottom-1 -right-1 z-10 rounded-full border border-[#333] bg-[#222] p-0.5">
            {team === "police" && <Shield className="h-3 w-3 fill-blue-400/20 text-blue-400" />}
            {team === "sheriff" && <Star className="h-3 w-3 fill-amber-400/20 text-amber-400" />}
            {team === "dot" && <Truck className="h-3 w-3 text-orange-400" />}
        </span>
    )
}

function LogRow({ id }: { id: number }) {
    const log = LOGS[id % LOGS.length]
    return (
        <motion.li
            layout
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="flex items-start gap-2.5 rounded border-l-2 border-indigo-500 bg-[#222] p-2 text-xs"
        >
            <span className="mt-0.5 shrink-0">
                {log.kind === "join" && <ScrollText className="h-3.5 w-3.5 text-emerald-400" />}
                {log.kind === "leave" && <LogOut className="h-3.5 w-3.5 text-zinc-400" />}
                {log.kind === "kill" && <Sword className="h-3.5 w-3.5 text-red-400" />}
                {log.kind === "command" && <Terminal className="h-3.5 w-3.5 text-amber-400" />}
            </span>
            <p className="min-w-0 flex-1 break-words leading-relaxed text-zinc-300">
                {log.kind === "join" && (
                    <>
                        <span className="font-semibold text-emerald-400">{log.name}</span> joined the
                        server.
                    </>
                )}
                {log.kind === "leave" && (
                    <>
                        <span className="font-semibold text-zinc-300">{log.name}</span> left the
                        server.
                    </>
                )}
                {log.kind === "kill" && (
                    <>
                        <span className="font-semibold text-red-400">{log.killer}</span> killed{" "}
                        <span className="font-semibold text-white">{log.victim}</span>
                    </>
                )}
                {log.kind === "command" && (
                    <>
                        <span className="font-semibold text-amber-400">{log.name}</span> used:{" "}
                        <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[10px] text-zinc-300">
                            {log.cmd}
                        </code>
                    </>
                )}
            </p>
            <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] text-zinc-600">
                {stamp(id)}
            </span>
        </motion.li>
    )
}

export function ModPanelVignette() {
    const reduce = useReducedMotion()
    const [head, setHead] = useState(4)

    useEffect(() => {
        if (reduce) return
        const t = setInterval(() => setHead((h) => h + 1), 2200)
        return () => clearInterval(t)
    }, [reduce])

    const entries = Array.from({ length: 6 }, (_, k) => head - k).filter((n) => n >= 0)

    return (
        // Decorative product mockup with illustrative sample data: hidden from
        // assistive tech so screen readers don't announce the fake players/logs
        // as real content. It's presentation only.
        <div className="relative" role="img" aria-label="Preview of the Project Overwatch live mod panel" aria-hidden="true">
            {/* Multi-color glow behind the window */}
            <div
                aria-hidden
                className="absolute -inset-x-12 -top-12 bottom-0 bg-[radial-gradient(45%_50%_at_30%_20%,rgba(99,102,241,0.28),transparent_70%),radial-gradient(40%_45%_at_75%_15%,rgba(217,70,239,0.18),transparent_70%),radial-gradient(50%_40%_at_55%_90%,rgba(34,211,238,0.12),transparent_70%)]"
            />

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#131316] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.04]">
                {/* Title bar */}
                <div className="flex h-11 items-center gap-3 border-b border-white/[0.07] bg-[#0e0e11] px-4">
                    <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                    </div>
                    <div className="mx-auto hidden items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-[11px] text-zinc-500 sm:flex">
                        <Lock className="h-3 w-3" />
                        pow.atriasafety.org
                    </div>
                    <div className="ml-auto flex items-center gap-2 sm:ml-0">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                        </span>
                        <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-300">LIVE</span>
                    </div>
                </div>

                {/* Body */}
                <div className="grid h-[400px] grid-cols-[52px_1fr] md:h-[450px] lg:grid-cols-[52px_1.1fr_1fr]">
                    {/* Sidebar */}
                    <div className="flex flex-col items-center gap-2 border-r border-white/[0.07] py-4">
                        {SIDEBAR_ICONS.map((Icon, i) => (
                            <span
                                key={i}
                                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                                    i === 0
                                        ? "border border-indigo-400/25 bg-indigo-500/15 text-indigo-300"
                                        : "text-zinc-600"
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                            </span>
                        ))}
                    </div>

                    {/* Player list: mirrors ServerStatsHeader + PlayerList */}
                    <div className="flex flex-col overflow-hidden p-4 lg:border-r lg:border-white/[0.07]">
                        <div className="mb-3 flex shrink-0 items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-white">Players</h3>
                                <p className="text-[11px] text-zinc-500">Live server • Online</p>
                            </div>
                            <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        </div>
                        <ul className="flex flex-col gap-1">
                            {PLAYERS.map((p) => (
                                <li
                                    key={p.name}
                                    className="flex items-center gap-2 rounded-lg bg-[#222] p-2"
                                >
                                    <span className="relative shrink-0">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700">
                                            <User className="h-4 w-4 text-zinc-400" />
                                        </span>
                                        <TeamBadge team={p.team} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-2">
                                            {p.callsign && (
                                                <span className="rounded bg-zinc-700 px-1 text-[10px] font-bold text-zinc-300">
                                                    {p.callsign}
                                                </span>
                                            )}
                                            <span className="truncate text-sm font-medium text-white">
                                                {p.name}
                                            </span>
                                        </span>
                                        <span className="flex items-center gap-1 truncate text-[10px] text-zinc-500">
                                            {p.postal && (
                                                <span className="font-bold text-sky-400">[{p.postal}]</span>
                                            )}
                                            <span className="text-zinc-400">{p.sub}</span>
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Live Logs: mirrors log-viewer.tsx compact mode */}
                    <div className="hidden flex-col overflow-hidden lg:flex">
                        <div className="flex shrink-0 items-center justify-between border-b border-[#2a2a2a] p-3.5">
                            <h3 className="text-sm font-bold text-white">Live Logs</h3>
                            <Filter className="h-4 w-4 text-zinc-500" />
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 border-b border-[#2a2a2a] p-2">
                            <div className="flex gap-1.5">
                                {["All", "Join", "Kill", "Command"].map((f, i) => (
                                    <span
                                        key={f}
                                        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                                            i === 0
                                                ? "bg-indigo-500 text-white"
                                                : "bg-[#2a2a2a] text-zinc-400"
                                        }`}
                                    >
                                        {f}
                                    </span>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 rounded bg-[#2a2a2a] px-3 py-1.5">
                                <Search className="h-3 w-3 text-zinc-500" />
                                <span className="text-[11px] text-zinc-500">Search logs...</span>
                            </div>
                        </div>
                        <ul className="flex flex-1 flex-col gap-1.5 overflow-hidden p-2">
                            <AnimatePresence initial={false} mode="popLayout">
                                {entries.map((id) => (
                                    <LogRow key={id} id={id} />
                                ))}
                            </AnimatePresence>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}
