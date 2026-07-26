"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { ChevronRight, HeartHandshake, ShieldCheck, UsersRound } from "lucide-react"
import { useUser } from "@clerk/nextjs"
import { FeatureBento } from "./bento"
import { Reveal } from "./bits"
import { ModPanelVignette } from "./vignette"

const DOCS_URL = "https://powdocs.atriasafety.org/"
const DISCORD_URL = "https://discord.gg/lacomm"

// Every entry is a shipped capability, verified in code: Log/ModCall/Shift/
// Punishment/VehicleLog/ApiKey models, mod-panel & admin components
// (audit, automations, milestones, raid-mitigation, quota, LOA, roles),
// bot commands, Vision overlay, PWA. Nothing aspirational.
const CAPABILITIES = [
    "Live player list",
    "Kill logs",
    "Join & leave logs",
    "Command logs",
    "Vehicle logs",
    "Mod calls",
    "Live map",
    "Punishment history",
    "Ban BOLOs",
    "Warnings",
    "Kicks & bans",
    "Shift tracking",
    "Quotas",
    "Custom forms",
    "Conditional questions",
    "Collaborative form editing",
    "Role sync",
    "Granular role permissions",
    "Perm logs",
    "LOA requests",
    "Staff requests",
    "Run command",
    "In-game chat commands",
    "Discord slash commands",
    "Discord log sync",
    "Automated DMs",
    "OCR player lookup",
    "Desktop overlay",
    "Staff on duty",
    "Player search",
    "Player callsigns",
    "Postal & street tracking",
    "Team badges",
    "Audit log",
    "Automations",
    "Milestones",
    "Raid mitigation",
    "API keys",
    "Mobile PWA",
    "Multi-server support",
]

const DOT_COLORS = [
    "bg-indigo-400",
    "bg-violet-400",
    "bg-fuchsia-400",
    "bg-cyan-400",
    "bg-emerald-400",
    "bg-amber-400",
    "bg-rose-400",
    "bg-sky-400",
]

const STEPS = [
    {
        n: "01",
        grad: "from-indigo-400 to-violet-400",
        title: "Sign in",
        body: "Sign in and link your Discord and Roblox accounts. That's your identity across the whole platform.",
    },
    {
        n: "02",
        grad: "from-violet-400 to-fuchsia-400",
        title: "Connect your server",
        body: "Add your ER:LC server with its PRC server key and invite the POW bot to your Discord.",
    },
    {
        n: "03",
        grad: "from-fuchsia-400 to-cyan-400",
        title: "Go live",
        body: "Your staff open the mod panel and everything is already streaming: players, logs, calls.",
    },
]

// Claims carried over from the existing shipped landing page.
const MISSION_CARDS = [
    {
        icon: HeartHandshake,
        iconCls: "from-emerald-500 to-teal-500 shadow-emerald-500/30",
        title: "Free",
        body: "Always free for communities",
    },
    {
        icon: UsersRound,
        iconCls: "from-violet-500 to-fuchsia-500 shadow-violet-500/30",
        title: "Open",
        body: "Built with the community",
    },
    {
        icon: ShieldCheck,
        iconCls: "from-cyan-500 to-sky-500 shadow-cyan-500/30",
        title: "Secure",
        body: "Your data stays yours",
    },
]

function DiscordIcon({ className = "" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
    )
}

function CapabilityMarquee() {
    const reduce = useReducedMotion()
    const row = (
        <div className="flex shrink-0 items-center">
            {CAPABILITIES.map((c, i) => (
                <span
                    key={c}
                    className="flex items-center whitespace-nowrap text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400"
                >
                    {c}
                    <span className={`mx-5 h-1.5 w-1.5 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]} opacity-70`} />
                </span>
            ))}
        </div>
    )

    if (reduce) {
        return (
            <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-6 gap-y-3 px-6">
                {CAPABILITIES.map((c) => (
                    <span key={c} className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                        {c}
                    </span>
                ))}
            </div>
        )
    }

    return (
        <div className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-[#08080b] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-[#08080b] to-transparent" />
            <motion.div
                className="flex w-max"
                animate={{ x: ["0%", "-50%"] }}
                transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
            >
                {row}
                {row}
            </motion.div>
        </div>
    )
}

export function MeridianLanding({ showPricing = false }: { showPricing?: boolean }) {
    const [scrolled, setScrolled] = useState(false)
    // Default to the signed-out state so CTAs render immediately (and even if
    // Clerk fails to load); swap to "Dashboard" once a session is confirmed.
    const { isSignedIn } = useUser()
    const reduce = useReducedMotion()

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 24)
        onScroll()
        window.addEventListener("scroll", onScroll, { passive: true })
        return () => window.removeEventListener("scroll", onScroll)
    }, [])

    const primaryCta = (
        <Link
            href={isSignedIn ? "/dashboard" : "/login"}
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/40 hover:brightness-110"
        >
            {isSignedIn ? "Open the dashboard" : "Get started for free"}
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
    )

    return (
        <div className="min-h-screen bg-[#08080b] font-sans text-zinc-300 antialiased selection:bg-indigo-500/30 selection:text-white">
            {/* ------------------------------- nav ------------------------------- */}
            <nav
                className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
                    scrolled
                        ? "border-b border-white/[0.06] bg-[#08080b]/75 backdrop-blur-xl"
                        : "border-b border-transparent bg-transparent"
                }`}
            >
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
                    <Link href="/" className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/logo.png" alt="Project Overwatch" className="h-8 w-8" />
                        <span className="text-sm font-bold tracking-tight text-white">
                            Project Overwatch
                        </span>
                    </Link>
                    <div className="hidden items-center gap-7 md:flex">
                        <a href="#features" className="text-sm text-zinc-400 transition-colors hover:text-white">
                            Features
                        </a>
                        <a href="#how" className="text-sm text-zinc-400 transition-colors hover:text-white">
                            How it works
                        </a>
                        {showPricing && (
                            <Link href="/pricing" className="text-sm text-zinc-400 transition-colors hover:text-white">
                                Pricing
                            </Link>
                        )}
                        <a
                            href={DOCS_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-zinc-400 transition-colors hover:text-white"
                        >
                            Docs
                        </a>
                        <Link
                            href={isSignedIn ? "/dashboard" : "/login"}
                            className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:brightness-110"
                        >
                            {isSignedIn ? "Dashboard" : "Sign in"}
                        </Link>
                    </div>
                    <div className="flex items-center gap-4 md:hidden">
                        <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-400">
                            Docs
                        </a>
                        <Link
                            href={isSignedIn ? "/dashboard" : "/login"}
                            className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white"
                        >
                            {isSignedIn ? "Dashboard" : "Sign in"}
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ------------------------------- hero ------------------------------ */}
            <header className="relative overflow-hidden">
                {/* Aurora backdrop: soft radial gradients (no blur filters: cheap to
                    composite, identical look) drifting on transform only */}
                <div aria-hidden className="absolute inset-0 overflow-hidden">
                    <motion.div
                        className="absolute -top-48 h-[560px] w-[760px] bg-[radial-gradient(closest-side,rgba(79,70,229,0.35),transparent)]"
                        style={{ left: "8%" }}
                        animate={reduce ? undefined : { x: [0, 60, 0], y: [0, 30, 0] }}
                        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                        className="absolute -top-40 h-[520px] w-[680px] bg-[radial-gradient(closest-side,rgba(217,70,239,0.22),transparent)]"
                        style={{ right: "4%" }}
                        animate={reduce ? undefined : { x: [0, -50, 0], y: [0, 40, 0] }}
                        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                        className="absolute left-1/2 top-56 h-[480px] w-[640px] -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(34,211,238,0.13),transparent)]"
                        animate={reduce ? undefined : { x: [0, 40, 0], y: [0, -30, 0] }}
                        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
                    />
                </div>
                {/* Fine grid */}
                <div
                    aria-hidden
                    className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]"
                />

                <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-32 md:pb-28 md:pt-44">
                    <motion.div
                        initial={reduce ? false : { opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.21, 0.6, 0.35, 1] }}
                        className="mx-auto max-w-3xl text-center"
                    >
                        <h1 className="mb-6 text-[clamp(2.1rem,13vw,3rem)] font-black leading-[0.95] tracking-tighter text-white sm:text-6xl md:text-7xl">
                            ERLC moderation,
                            <br />
                            {/* Static gradient: animating background-position on clipped
                                text forces full-layer re-rasters every frame */}
                            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                                but better.
                            </span>
                        </h1>
                        <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-zinc-400 md:text-lg">
                            Project Overwatch is the live moderation platform for Emergency
                            Response: Liberty County. A real-time mod panel, a Discord bot, and a
                            desktop overlay, all working off the same data.
                        </p>
                        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                            {primaryCta}
                            <a
                                href={DISCORD_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
                            >
                                <DiscordIcon className="h-4 w-4" />
                                Join the Discord
                            </a>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={reduce ? false : { opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.9, delay: 0.15, ease: [0.21, 0.6, 0.35, 1] }}
                        className="mx-auto mt-16 max-w-4xl md:mt-20"
                    >
                        <ModPanelVignette />
                    </motion.div>
                </div>
            </header>

            {/* --------------------------- capabilities -------------------------- */}
            <section aria-label="Capabilities" className="border-y border-white/[0.05] py-8">
                <CapabilityMarquee />
            </section>

            {/* ------------------------------ features --------------------------- */}
            <section id="features" className="scroll-mt-24 py-24 md:py-32">
                <div className="mx-auto max-w-6xl px-6">
                    <Reveal className="mb-14 max-w-2xl">
                        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-indigo-400">
                            Features
                        </p>
                        <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white md:text-5xl">
                            Everything your staff team{" "}
                            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                                runs on
                            </span>
                        </h2>
                        <p className="text-base leading-relaxed text-zinc-500 md:text-lg">
                            One platform instead of five spreadsheets: the panel your mods watch,
                            the bot your Discord runs on, and the overlay your staff play with.
                        </p>
                    </Reveal>
                    <FeatureBento />
                </div>
            </section>

            {/* ----------------------------- how it works ------------------------ */}
            <section id="how" className="scroll-mt-24 border-t border-white/[0.05] py-24 md:py-32">
                <div className="mx-auto max-w-6xl px-6">
                    <Reveal className="mb-14 max-w-2xl">
                        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
                            How it works
                        </p>
                        <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">
                            Live in{" "}
                            <span className="bg-gradient-to-r from-cyan-400 to-sky-400 bg-clip-text text-transparent">
                                three steps
                            </span>
                        </h2>
                    </Reveal>
                    <div className="grid gap-4 md:grid-cols-3">
                        {STEPS.map((s, i) => (
                            <Reveal key={s.n} delay={i * 0.08}>
                                <div className="relative h-full rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition-colors duration-300 hover:border-white/[0.16]">
                                    <span
                                        className={`mb-6 block bg-gradient-to-br ${s.grad} bg-clip-text text-5xl font-black tracking-tighter text-transparent`}
                                    >
                                        {s.n}
                                    </span>
                                    <h3 className="mb-2 text-base font-bold text-zinc-100">{s.title}</h3>
                                    <p className="text-sm leading-relaxed text-zinc-500">{s.body}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ------------------------------- mission --------------------------- */}
            <section id="about" className="scroll-mt-24 border-t border-white/[0.05] py-24 md:py-32">
                <div className="relative mx-auto max-w-6xl px-6">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 -top-10 mx-auto h-80 max-w-3xl bg-[radial-gradient(45%_50%_at_35%_35%,rgba(217,70,239,0.14),transparent_70%),radial-gradient(45%_50%_at_70%_50%,rgba(99,102,241,0.14),transparent_70%)]"
                    />
                    <Reveal className="relative mx-auto max-w-3xl text-center">
                        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-400">
                            Why it&apos;s free
                        </p>
                        <h2 className="mb-6 text-3xl font-extrabold tracking-tight text-white md:text-5xl">
                            Built by ER:LC players.
                            <br />
                            <span className="bg-gradient-to-r from-fuchsia-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
                                Run by a non-profit.
                            </span>
                        </h2>
                        <p className="mx-auto max-w-2xl text-base leading-relaxed text-zinc-400 md:text-lg">
                            Project Overwatch is owned and operated by Atria, a 501(c)(3)
                            non-profit. It exists to make running a community easier, not to
                            monetize it.
                        </p>
                    </Reveal>
                    <div className="relative mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3">
                        {MISSION_CARDS.map(({ icon: Icon, iconCls, title, body }, i) => (
                            <Reveal key={title} delay={i * 0.08}>
                                <div className="flex h-full flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
                                    <span
                                        className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${iconCls}`}
                                    >
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    <span className="text-lg font-bold text-white">{title}</span>
                                    <span className="text-sm text-zinc-500">{body}</span>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* --------------------------------- cta ----------------------------- */}
            <section className="px-6 pb-24 md:pb-32">
                <Reveal className="mx-auto max-w-4xl">
                    <div className="rounded-3xl bg-gradient-to-r from-indigo-500/50 via-fuchsia-500/40 to-cyan-400/40 p-px">
                        <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-[#0b0b10] px-6 py-16 text-center md:py-20">
                            <div
                                aria-hidden
                                className="absolute inset-0 bg-[radial-gradient(50%_100%_at_30%_0%,rgba(99,102,241,0.2),transparent_70%),radial-gradient(50%_100%_at_75%_0%,rgba(217,70,239,0.14),transparent_70%)]"
                            />
                            <div className="relative">
                                <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white md:text-5xl">
                                    Ready to level up your server?
                                </h2>
                                <p className="mx-auto mb-10 max-w-md text-sm leading-relaxed text-zinc-400 md:text-base">
                                    Want POW on your server? You&apos;re one click away. Get set
                                    up in minutes, free forever.
                                </p>
                                <div className="flex items-center justify-center">
                                    {primaryCta}
                                </div>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* ------------------------------- footer ---------------------------- */}
            <footer className="border-t border-white/[0.05] py-12">
                <div className="mx-auto max-w-6xl px-6">
                    <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
                        <div className="flex items-center gap-2.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo.png" alt="" className="h-7 w-7 opacity-80" />
                            <span className="text-sm font-bold text-zinc-200">Project Overwatch</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
                            <a href="#features" className="text-xs text-zinc-500 transition-colors hover:text-zinc-200">
                                Features
                            </a>
                            <a href="#how" className="text-xs text-zinc-500 transition-colors hover:text-zinc-200">
                                How it works
                            </a>
                            <a
                                href={DOCS_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-zinc-500 transition-colors hover:text-zinc-200"
                            >
                                Docs
                            </a>
                            <a
                                href={DISCORD_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-zinc-500 transition-colors hover:text-zinc-200"
                            >
                                Discord
                            </a>
                            <a
                                href="https://powdocs.atriasafety.org/legal/legal-terms-of-service"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-zinc-500 transition-colors hover:text-zinc-200"
                            >
                                Terms
                            </a>
                            <a
                                href="https://powdocs.atriasafety.org/legal/legal-privacy-policy"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-zinc-500 transition-colors hover:text-zinc-200"
                            >
                                Privacy
                            </a>
                            <Link href="/login" className="text-xs text-zinc-500 transition-colors hover:text-zinc-200">
                                Sign in
                            </Link>
                        </div>
                    </div>
                    <div className="mt-10 border-t border-white/[0.05] pt-6 text-center">
                        <p className="text-xs text-zinc-600">
                            © 2026 Project Overwatch · ERLC moderation but better™ · Operated by
                            Atria, a 501(c)(3) non-profit
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
