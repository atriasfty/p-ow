"use client"

import { createContext, useContext, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import {
    Bot,
    CalendarClock,
    ClipboardList,
    Clock,
    FileText,
    Gavel,
    Megaphone,
    MousePointer2,
    ScanLine,
    Terminal,
    Wrench,
} from "lucide-react"
import { Redact, Reveal } from "./bits"

// Per-card accent tones. Full literal class strings so Tailwind picks them up.
// Glows are pre-softened radial gradients: no blur filters to rasterize.
const TONES = {
    indigo: {
        icon: "bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30",
        glow: "bg-[radial-gradient(closest-side,rgba(99,102,241,0.22),transparent)]",
        hover: "hover:border-indigo-400/30 hover:shadow-[0_0_60px_-15px_rgba(99,102,241,0.4)]",
    },
    emerald: {
        icon: "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30",
        glow: "bg-[radial-gradient(closest-side,rgba(16,185,129,0.2),transparent)]",
        hover: "hover:border-emerald-400/30 hover:shadow-[0_0_60px_-15px_rgba(16,185,129,0.4)]",
    },
    rose: {
        icon: "bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-lg shadow-rose-500/30",
        glow: "bg-[radial-gradient(closest-side,rgba(244,63,94,0.2),transparent)]",
        hover: "hover:border-rose-400/30 hover:shadow-[0_0_60px_-15px_rgba(244,63,94,0.4)]",
    },
    amber: {
        icon: "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30",
        glow: "bg-[radial-gradient(closest-side,rgba(245,158,11,0.18),transparent)]",
        hover: "hover:border-amber-400/30 hover:shadow-[0_0_60px_-15px_rgba(245,158,11,0.4)]",
    },
    cyan: {
        icon: "bg-gradient-to-br from-cyan-500 to-sky-500 text-white shadow-lg shadow-cyan-500/30",
        glow: "bg-[radial-gradient(closest-side,rgba(34,211,238,0.18),transparent)]",
        hover: "hover:border-cyan-400/30 hover:shadow-[0_0_60px_-15px_rgba(34,211,238,0.4)]",
    },
    violet: {
        icon: "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30",
        glow: "bg-[radial-gradient(closest-side,rgba(139,92,246,0.22),transparent)]",
        hover: "hover:border-violet-400/30 hover:shadow-[0_0_60px_-15px_rgba(139,92,246,0.4)]",
    },
} as const

type Tone = keyof typeof TONES

// Card visuals only animate while the pointer is over their card.
const CardHoverContext = createContext(false)

function Card({
    tone,
    className = "",
    children,
}: {
    tone: Tone
    className?: string
    children: React.ReactNode
}) {
    const [hovered, setHovered] = useState(false)
    return (
        <CardHoverContext.Provider value={hovered}>
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={`group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition-all duration-300 ${TONES[tone].hover} ${className}`}
        >
            <div
                aria-hidden
                className={`pointer-events-none absolute -right-24 -top-24 h-64 w-64 transition-opacity duration-300 group-hover:opacity-100 opacity-60 ${TONES[tone].glow}`}
            />
            {children}
        </div>
        </CardHoverContext.Provider>
    )
}

function CardHeader({
    tone,
    icon: Icon,
    title,
    children,
}: {
    tone: Tone
    icon: React.ElementType
    title: string
    children: React.ReactNode
}) {
    return (
        <div className="relative mb-5">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${TONES[tone].icon}`}>
                <Icon className="h-4.5 w-4.5" />
            </div>
            <h3 className="mb-1.5 text-base font-bold text-zinc-100">{title}</h3>
            <p className="text-sm leading-relaxed text-zinc-500">{children}</p>
        </div>
    )
}

/* ---------- mini visuals ---------- */

function BotVisual() {
    return (
        <div className="relative mt-auto grid gap-3 sm:grid-cols-2">
            {/* In-game chat */}
            <div className="rounded-xl border border-white/[0.07] bg-black/30 p-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    In-game chat
                </p>
                <div className="flex flex-col gap-2 font-mono text-[11px]">
                    <div className="flex items-center gap-2">
                        <span className="rounded bg-indigo-400/15 px-1.5 py-0.5 text-indigo-300">
                            :log warn
                        </span>
                        <Redact w={72} />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="rounded bg-indigo-400/15 px-1.5 py-0.5 text-indigo-300">
                            :log shift start
                        </span>
                    </div>
                    <div className="flex items-center gap-2 opacity-50">
                        <Redact w={44} />
                        <Redact w={90} />
                    </div>
                </div>
            </div>
            {/* Discord side */}
            <div className="rounded-xl border border-white/[0.07] bg-black/30 p-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    Discord
                </p>
                <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5865F2]/25 text-[#8891f2]">
                        <Bot className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex w-full flex-col gap-2 pt-1">
                        <div className="flex items-center gap-2">
                            <Redact w={56} className="bg-[#5865F2]/40" />
                            <span className="rounded bg-[#5865F2]/20 px-1 py-px text-[9px] font-bold text-[#8891f2]">
                                BOT
                            </span>
                        </div>
                        <div className="rounded-md border-l-2 border-indigo-400/50 bg-white/[0.04] p-2">
                            <div className="flex flex-col gap-1.5">
                                <Redact w={100} />
                                <Redact w={64} className="opacity-60" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function VisionVisual() {
    const reduce = useReducedMotion()
    const hovered = useContext(CardHoverContext)
    return (
        <div className="relative mt-auto flex h-28 items-center justify-center overflow-hidden rounded-xl border border-white/[0.07] bg-black/30">
            {/* Corner brackets */}
            <div className="relative flex items-center gap-2 px-5 py-3">
                <span className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-emerald-400/70" />
                <span className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-emerald-400/70" />
                <span className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-emerald-400/70" />
                <span className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-emerald-400/70" />
                <Redact w={96} className="h-2.5" />
            </div>
            <span className="absolute right-2 top-2 rounded bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-emerald-300">
                OCR
            </span>
            {!reduce && (
                <motion.div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
                    animate={hovered ? { y: [14, 98, 14] } : { y: 14 }}
                    transition={
                        hovered
                            ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
                            : { duration: 0.4, ease: "easeOut" }
                    }
                />
            )}
        </div>
    )
}

function PunishmentsVisual() {
    return (
        <div className="relative mt-auto flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
                {[
                    ["Warn", "text-amber-300 border-amber-400/25 bg-amber-400/10"],
                    ["Kick", "text-orange-300 border-orange-400/25 bg-orange-400/10"],
                    ["Ban", "text-rose-300 border-rose-400/25 bg-rose-400/10"],
                    ["Ban BOLO", "text-fuchsia-300 border-fuchsia-400/25 bg-fuchsia-400/10"],
                ].map(([label, cls]) => (
                    <span
                        key={label}
                        className={`rounded-md border px-2 py-1 text-[10px] font-bold ${cls}`}
                    >
                        {label}
                    </span>
                ))}
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl border border-white/[0.07] bg-black/30 p-3">
                {[88, 64, 104].map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400/50" />
                        <Redact w={w} />
                        <Redact w={28} className="ml-auto opacity-40" />
                    </div>
                ))}
            </div>
        </div>
    )
}

function ShiftsVisual() {
    return (
        <div className="relative mt-auto flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-black/30 p-3">
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </span>
                    On duty
                </span>
                <Redact w={36} className="opacity-50" />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-amber-400 to-orange-400 opacity-90" />
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-600">
                <span>Quota</span>
                <Redact w={44} className="opacity-40" />
            </div>
        </div>
    )
}

function FormsVisual() {
    const reduce = useReducedMotion()
    const hovered = useContext(CardHoverContext)
    const animateCursors = hovered && !reduce
    return (
        <div className="relative mt-auto flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-black/30 p-3">
            {[110, 84].map((w, i) => (
                <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <Redact w={w} />
                    <div className="h-6 rounded-md border border-white/[0.07] bg-white/[0.03]" />
                </div>
            ))}
            {/* Live collaborator cursors: transform-driven so they stay on the compositor */}
            <motion.div
                aria-hidden
                className="absolute left-[58%] top-[22%]"
                animate={animateCursors ? { x: [0, -50, 20, 0], y: [0, 45, 22, 0] } : { x: 0, y: 0 }}
                transition={
                    animateCursors
                        ? { duration: 9, repeat: Infinity, ease: "easeInOut" }
                        : { duration: 0.4, ease: "easeOut" }
                }
            >
                <MousePointer2 className="h-3.5 w-3.5 fill-cyan-400 text-cyan-400" />
                <span className="ml-3 flex rounded-full bg-cyan-400/90 px-1.5 py-0.5">
                    <Redact w={26} className="h-1.5 bg-cyan-950/60" />
                </span>
            </motion.div>
            <motion.div
                aria-hidden
                className="absolute left-[20%] top-[64%]"
                animate={animateCursors ? { x: [0, 60, -14, 0], y: [0, -42, -18, 0] } : { x: 0, y: 0 }}
                transition={
                    animateCursors
                        ? { duration: 11, repeat: Infinity, ease: "easeInOut" }
                        : { duration: 0.4, ease: "easeOut" }
                }
            >
                <MousePointer2 className="h-3.5 w-3.5 fill-fuchsia-400 text-fuchsia-400" />
                <span className="ml-3 flex rounded-full bg-fuchsia-400/90 px-1.5 py-0.5">
                    <Redact w={20} className="h-1.5 bg-fuchsia-950/60" />
                </span>
            </motion.div>
        </div>
    )
}

const TOOLBOX_ITEMS = [
    { icon: ClipboardList, label: "Perm Log", cls: "text-violet-300 border-violet-400/20 bg-violet-400/10" },
    { icon: CalendarClock, label: "LOA Request", cls: "text-amber-300 border-amber-400/20 bg-amber-400/10" },
    { icon: Terminal, label: "Run Command", cls: "text-emerald-300 border-emerald-400/20 bg-emerald-400/10" },
    { icon: Megaphone, label: "Staff Request", cls: "text-rose-300 border-rose-400/20 bg-rose-400/10" },
]

/* --------------------------------- grid --------------------------------- */

export function FeatureBento() {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Reveal className="md:col-span-2">
                <Card tone="indigo" className="h-full">
                    <CardHeader tone="indigo" icon={Bot} title="A Discord bot that does the boring parts">
                        Logs sync from the game to your Discord automatically. Staff can type{" "}
                        <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-xs text-indigo-300">
                            :log warn
                        </code>{" "}
                        or{" "}
                        <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-xs text-indigo-300">
                            :log shift start
                        </code>{" "}
                        right in game chat and the bot picks it up. Roles stay synced between Discord
                        and your staff roster.
                    </CardHeader>
                    <BotVisual />
                </Card>
            </Reveal>

            <Reveal delay={0.08}>
                <Card tone="emerald" className="h-full">
                    <CardHeader tone="emerald" icon={ScanLine} title="Vision overlay">
                        A desktop overlay that reads your screen with OCR and identifies the player
                        you&apos;re looking at, without alt-tabbing out of the game.
                    </CardHeader>
                    <VisionVisual />
                </Card>
            </Reveal>

            <Reveal>
                <Card tone="rose" className="h-full">
                    <CardHeader tone="rose" icon={Gavel} title="Punishments with a paper trail">
                        Warn, kick, ban, and BOLO-ban from the player panel. Every action lands on
                        the player&apos;s permanent record.
                    </CardHeader>
                    <PunishmentsVisual />
                </Card>
            </Reveal>

            <Reveal delay={0.08}>
                <Card tone="amber" className="h-full">
                    <CardHeader tone="amber" icon={Clock} title="Shifts &amp; quotas">
                        Staff clock in and out, time on duty is tracked automatically, and quota
                        progress is visible at a glance.
                    </CardHeader>
                    <ShiftsVisual />
                </Card>
            </Reveal>

            <Reveal delay={0.16}>
                <Card tone="cyan" className="h-full">
                    <CardHeader tone="cyan" icon={FileText} title="Forms, edited together">
                        Applications and surveys with conditional questions, built in a
                        collaborative editor where your whole team works on the same form, live.
                    </CardHeader>
                    <FormsVisual />
                </Card>
            </Reveal>

            <Reveal className="md:col-span-3">
                <Card tone="violet" className="md:flex-row md:items-center md:gap-8">
                    <div className="relative mb-5 max-w-sm md:mb-0">
                        <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${TONES.violet.icon}`}>
                            <Wrench className="h-4.5 w-4.5" />
                        </div>
                        <h3 className="mb-1.5 text-base font-bold text-zinc-100">The Toolbox</h3>
                        <p className="text-sm leading-relaxed text-zinc-500">
                            The everyday actions your staff reach for, one tap away.
                        </p>
                    </div>
                    <div className="relative grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
                        {TOOLBOX_ITEMS.map(({ icon: Icon, label, cls }) => (
                            <div
                                key={label}
                                className={`flex flex-col items-start gap-2.5 rounded-xl border bg-black/30 p-4 transition-colors ${cls}`}
                            >
                                <Icon className="h-4.5 w-4.5" />
                                <span className="text-xs font-semibold text-zinc-200">{label}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </Reveal>
        </div>
    )
}
