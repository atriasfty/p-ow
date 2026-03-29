"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ChevronRight, Shield, Zap, Users, Clock, FileText, ArrowRight, Bot } from "lucide-react"
import { useUser } from "@clerk/nextjs"

export function LandingPage({ showPricing = false }: { showPricing?: boolean }) {
    const [scrollY, setScrollY] = useState(0)
    const { isSignedIn, isLoaded } = useUser()

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY)
        window.addEventListener("scroll", handleScroll, { passive: true })
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    const scrollTo = (id: string) => {
        const element = document.getElementById(id)
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" })
        }
    }

    return (
        <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans antialiased">
            {/* Navigation */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrollY > 50 ? "bg-white/80 backdrop-blur-xl shadow-sm" : "bg-transparent"
                }`}>
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        <div className="flex items-center gap-3">
                            <img src="/logo.png" alt="POW" className="h-10 w-10 invert" />
                            <span className="text-xl font-semibold tracking-tight">Project Overwatch</span>
                        </div>
                        <div className="hidden md:flex items-center gap-8">
                            <button onClick={() => scrollTo("features")} className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">Features</button>
                            {showPricing && (
                                <Link href="/pricing" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">Pricing</Link>
                            )}
                            <button onClick={() => scrollTo("about")} className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">About</button>
                            {isLoaded && (
                                isSignedIn ? (
                                    <Link
                                        href="/dashboard"
                                        className="px-5 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-full hover:bg-zinc-800 transition-all hover:scale-105"
                                    >
                                        Dashboard
                                    </Link>
                                ) : (
                                    <Link
                                        href="/login"
                                        className="px-5 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-full hover:bg-zinc-800 transition-all hover:scale-105"
                                    >
                                        Sign In
                                    </Link>
                                )
                            )}
                        </div>
                        {isLoaded && (
                            isSignedIn ? (
                                <Link
                                    href="/dashboard"
                                    className="md:hidden px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-full"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <Link
                                    href="/login"
                                    className="md:hidden px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-full"
                                >
                                    Sign In
                                </Link>
                            )
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
                {/* Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-violet-50" />

                {/* Animated Gradient Orbs */}
                <div
                    className="absolute top-1/4 -left-32 w-96 h-96 bg-gradient-to-r from-indigo-400/30 to-violet-400/30 rounded-full blur-3xl"
                    style={{ transform: `translateY(${scrollY * 0.1}px)` }}
                />
                <div
                    className="absolute bottom-1/4 -right-32 w-96 h-96 bg-gradient-to-r from-violet-400/20 to-pink-400/20 rounded-full blur-3xl"
                    style={{ transform: `translateY(${-scrollY * 0.15}px)` }}
                />

                <div className="relative z-10 max-w-5xl mx-auto px-6 pt-32 pb-20 text-center">
                    {/* Main Headline */}
                    <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.85] mb-8">
                        <span className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 bg-clip-text text-transparent">
                            ERLC moderation
                        </span>
                        <br />
                        <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600 bg-clip-text text-transparent animate-gradient">
                            but better
                        </span>
                    </h1>

                    {/* Subheadline */}
                    <p className="text-xl md:text-2xl text-zinc-600 max-w-2xl mx-auto mb-14 leading-relaxed">
                        The <span className="font-semibold text-zinc-900">modern, professional-grade</span> management platform for Emergency Response: Liberty County servers.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={() => scrollTo("cta")}
                            className="group flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xl font-bold rounded-2xl hover:from-indigo-500 hover:to-violet-500 transition-all shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1 hover:scale-105"
                        >
                            Get Started Free
                            <ChevronRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button
                            onClick={() => scrollTo("features")}
                            className="flex items-center gap-2 px-10 py-5 text-zinc-700 text-xl font-semibold hover:text-zinc-900 transition-colors"
                        >
                            See Features
                            <ArrowRight className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-32 bg-white">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    {/* Section Header */}
                    <div className="text-center mb-20">
                        <p className="text-sm font-semibold text-indigo-600 tracking-wide uppercase mb-4">Features</p>
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                            Everything you need to run a<br />professional ERLC server
                        </h2>
                        <p className="text-xl text-zinc-500 max-w-2xl mx-auto">
                            A comprehensive suite of tools designed for modern server management.
                        </p>
                    </div>

                    {/* Feature Cards Grid */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* Card 1 */}
                        <div className="group p-8 bg-gradient-to-br from-zinc-50 to-zinc-100/50 rounded-3xl border border-zinc-200 hover:border-zinc-300 transition-all hover:-translate-y-1 hover:shadow-xl">
                            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Shield className="h-7 w-7 text-white" />
                            </div>
                            <h3 className="text-xl font-semibold mb-3">Mod Panel</h3>
                            <p className="text-zinc-500 leading-relaxed">
                                Real-time player management with kick, ban, and warning systems. Execute commands instantly with full audit logging.
                            </p>
                        </div>

                        {/* Card 2 */}
                        <div className="group p-8 bg-gradient-to-br from-zinc-50 to-zinc-100/50 rounded-3xl border border-zinc-200 hover:border-zinc-300 transition-all hover:-translate-y-1 hover:shadow-xl">
                            <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-pink-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Clock className="h-7 w-7 text-white" />
                            </div>
                            <h3 className="text-xl font-semibold mb-3">Shift Tracking</h3>
                            <p className="text-zinc-500 leading-relaxed">
                                Automated shift logging with time tracking. Monitor staff activity and generate detailed performance reports.
                            </p>
                        </div>

                        {/* Card 3 - Bot */}
                        <div className="group p-8 bg-gradient-to-br from-zinc-50 to-zinc-100/50 rounded-3xl border border-zinc-200 hover:border-zinc-300 transition-all hover:-translate-y-1 hover:shadow-xl">
                            <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Bot className="h-7 w-7 text-white" />
                            </div>
                            <h3 className="text-xl font-semibold mb-3">Discord Bot</h3>
                            <p className="text-zinc-500 leading-relaxed">
                                Powerful Discord bot with commands for moderation, lookups, and server management. Seamlessly integrated.
                            </p>
                        </div>

                        {/* Card 4 */}
                        <div className="group p-8 bg-gradient-to-br from-zinc-50 to-zinc-100/50 rounded-3xl border border-zinc-200 hover:border-zinc-300 transition-all hover:-translate-y-1 hover:shadow-xl">
                            <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Users className="h-7 w-7 text-white" />
                            </div>
                            <h3 className="text-xl font-semibold mb-3">Role Management</h3>
                            <p className="text-zinc-500 leading-relaxed">
                                Discord-synced role system with granular permissions. Auto-assign roles based on Discord membership.
                            </p>
                        </div>

                        {/* Card 5 */}
                        <div className="group p-8 bg-gradient-to-br from-zinc-50 to-zinc-100/50 rounded-3xl border border-zinc-200 hover:border-zinc-300 transition-all hover:-translate-y-1 hover:shadow-xl">
                            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Zap className="h-7 w-7 text-white" />
                            </div>
                            <h3 className="text-xl font-semibold mb-3">Automations</h3>
                            <p className="text-zinc-500 leading-relaxed">
                                Set up automated actions triggered by events. From welcome messages to scheduled commands.
                            </p>
                        </div>

                        {/* Card 6 */}
                        <div className="group p-8 bg-gradient-to-br from-zinc-50 to-zinc-100/50 rounded-3xl border border-zinc-200 hover:border-zinc-300 transition-all hover:-translate-y-1 hover:shadow-xl">
                            <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <FileText className="h-7 w-7 text-white" />
                            </div>
                            <h3 className="text-xl font-semibold mb-3">Custom Forms</h3>
                            <p className="text-zinc-500 leading-relaxed">
                                Build application forms, surveys, and more. Role-gated access with response tracking and analytics.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* About / Mission Section */}
            <section id="about" className="py-32 bg-zinc-900 text-white relative overflow-hidden">
                {/* Background Elements */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />

                <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-8 text-center">
                    <p className="text-sm font-semibold text-indigo-400 tracking-wide uppercase mb-4">Our Mission</p>
                    <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 leading-tight">
                        Making server management<br />
                        <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                            accessible to everyone
                        </span>
                    </h2>
                    <p className="text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed mb-12">
                        Project Overwatch was built by ERLC players, for ERLC players. We understand the challenges of running a community,
                        and we've created the tools to make it easier. No more spreadsheets. No more manual tracking. Just a beautiful,
                        powerful platform that works.
                    </p>

                    {/* Feature Highlights */}
                    <div className="grid md:grid-cols-3 gap-8 mt-16">
                        <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                            <div className="text-3xl font-bold text-white mb-2">Free</div>
                            <div className="text-zinc-400">Always free for communities</div>
                        </div>
                        <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                            <div className="text-3xl font-bold text-white mb-2">Open</div>
                            <div className="text-zinc-400">Built with the community</div>
                        </div>
                        <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                            <div className="text-3xl font-bold text-white mb-2">Secure</div>
                            <div className="text-zinc-400">Your data stays yours</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section id="cta" className="py-32 bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-700 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                        backgroundSize: '40px 40px'
                    }} />
                </div>

                <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
                    <h2 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-10">
                        Ready to level up your server?
                    </h2>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a
                            href="https://discord.gg/lacomm"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-3 px-10 py-5 bg-[#5865F2] text-white text-lg font-semibold rounded-2xl hover:bg-[#4752C4] transition-all shadow-2xl hover:-translate-y-1"
                        >
                            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                            </svg>
                            Join Our Discord
                        </a>
                    </div>
                    <p className="text-white/60 text-sm mt-6">
                        Want to integrate POW with your server? Join Discord and open a ticket!
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-16 bg-white border-t border-zinc-200">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-3">
                            <img src="/logo.png" alt="POW" className="h-10 w-10 opacity-80" />
                            <span className="text-lg font-semibold text-zinc-900">Project Overwatch</span>
                        </div>
                        <div className="flex items-center gap-8">
                            <a href="#features" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Features</a>
                            <a href="#about" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">About</a>
                            <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Sign In</Link>
                        </div>
                    </div>
                    <div className="mt-12 pt-8 border-t border-zinc-100 text-center">
                        <p className="text-sm text-zinc-500">
                            © 2026 Project Overwatch - erlc moderation but better™
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
