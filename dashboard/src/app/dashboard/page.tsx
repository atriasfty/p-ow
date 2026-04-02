import { UserButton } from "@clerk/nextjs"

import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isSuperAdmin } from "@/lib/admin"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Shield, LayoutDashboard, Users, Server as ServerIcon, FileText, AlertTriangle, ArrowRight, ShieldAlert, Plus } from "lucide-react"
import { EnsureDiscordConnection } from "@/components/auth/ensure-discord"
import { PrcClient } from "@/lib/prc"
import { RandomGreeting } from "@/components/random-greeting"
import { DashboardFooter } from "@/components/layout/dashboard-footer"
import { WarningBanner } from "@/components/ui/warning-banner"
import { UpsellBanner } from "@/components/subscription/upsell-banner"

import { performAutoJoin } from "@/lib/auto-join"
import { getUserPlan } from "@/lib/subscription"
import { sanitizeUrl } from "@/lib/auth-permissions"
import { isFeatureEnabled } from "@/lib/feature-flags"

// Helper to fetch stats SAFELY on server
async function fetchServerStats(apiUrl: string) {
    try {
        const client = new PrcClient(apiUrl)
        const info = await Promise.race([
            client.getServer(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2500))
        ])
        return { online: true, players: info.CurrentPlayers, maxPlayers: info.MaxPlayers }
    } catch (e) {
        return { online: false, players: 0, maxPlayers: 0 }
    }
}

export default async function ServerSelectorPage() {
    // ... session setup ...
    const session = await getSession()
    if (!session) redirect("/login")

    const canCreateServer = await isFeatureEnabled('SERVER_CREATION')

    // Run Auto-Join in the background (we await it so the page reflects new servers immediately if newly joined)
    if (session.user.discordId) {
        try {
            await performAutoJoin(session.user as any)
        } catch (e) {
            console.error("Auto-Join failed:", e)
        }
    }

    // Tenant Isolation: Only show servers the user is specifically a Member of
    // Data Overexposure Prevention: Only select necessary fields for the UI
    const memberships = await prisma.member.findMany({
        where: { userId: session.user.id },
        select: {
            server: {
                select: {
                    id: true,
                    name: true,
                    customName: true,
                    bannerUrl: true,
                    apiUrl: true, // Needed for fetchServerStats but we won't pass it to the client
                    subscriptionPlan: true
                }
            }
        }
    })

    const servers = memberships.map((m: any) => m.server)

    // Parallel fetch for all stats
    const serversWithStats = await Promise.all(servers.map(async (s: any) => {
        const stats = await fetchServerStats(s.apiUrl)
        return {
            id: s.id,
            name: s.name,
            customName: s.customName,
            bannerUrl: sanitizeUrl(s.bannerUrl), // XSS Prevention
            subscriptionPlan: s.subscriptionPlan,
            stats
        }
    }))

    // Check if user has a paid subscription but hasn't linked it
    const { plan: userPlan, linkedServerId } = await getUserPlan(session.user.id)
    const hasUnlinkedSubscription = (userPlan === 'pow-pro-user' || userPlan === 'pow-pro' || userPlan === 'pow-max') && !linkedServerId

    // Check if ANY server is free for global upsell
    const hasFreeServer = servers.some((s: any) => !s.subscriptionPlan || s.subscriptionPlan === 'free')
    const firstFreeServerId = servers.find((s: any) => !s.subscriptionPlan || s.subscriptionPlan === 'free')?.id

    return (
        <EnsureDiscordConnection>
            <div className="min-h-screen bg-[#111] font-sans text-zinc-100">
                <WarningBanner />
                <div className="p-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {/* Logo */}
                                <img
                                    src="/logo.png"
                                    alt="POW"
                                    className="h-12 w-12 rounded-xl object-contain"
                                />
                                <div className="space-y-1">
                                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                                        <RandomGreeting username={session.user.username || session.user.name || "User"} />
                                    </h1>
                                    <p className="text-zinc-400">Welcome to your command center.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {isSuperAdmin(session.user as any) && (
                                    <Link 
                                        href="/admin/super"
                                        className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-sm font-semibold rounded-lg transition-colors border border-amber-500/20"
                                    >
                                        <ShieldAlert className="h-4 w-4" />
                                        Superadmin
                                    </Link>
                                )}
                                <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: "h-10 w-10" } }} />
                            </div>
                        </div>

                        {/* Global Upsell */}
                        {hasFreeServer && firstFreeServerId && (
                            <UpsellBanner 
                                serverId={firstFreeServerId}
                                plan="free"
                                feature="GLOBAL_UPSELL"
                                title="Grow your Community"
                                description="Free plans include basic moderation. Pro adds Raid Detection, 5000 API reqs, and 100 AI summaries. Max adds Vision Access, White Labeling, and Data Exports."
                                storageKey="dashboard_global"
                            />
                        )}

                        {/* Unlinked Subscription Alert */}
                        {hasUnlinkedSubscription && (
                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex items-center justify-between animate-in slide-in-from-top-4 fade-in duration-500 shadow-lg">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                        <AlertTriangle className="h-5 w-5 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">You have an active subscription!</h3>
                                        <p className="text-sm text-indigo-200">You need to link your subscription to a server to apply your premium benefits.</p>
                                    </div>
                                </div>
                                <Link 
                                    href="/dashboard/subscription"
                                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 flex-shrink-0"
                                >
                                    Link to Server <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        )}

                        {/* Servers Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold text-white">My Servers & Departments</h2>
                                <div className="flex gap-4 items-center">
                                    {canCreateServer && (
                                        <Link 
                                            href="/dashboard/create"
                                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-sm font-semibold rounded-lg transition-colors border border-emerald-500/20 shadow-lg shadow-emerald-500/5 group"
                                        >
                                            <Plus className="h-4 w-4 transition-transform group-hover:scale-110" />
                                            Create Server
                                        </Link>
                                    )}
                                    <div className="flex gap-2 text-zinc-400">
                                        {/* Grid/List info icons placeholder */}
                                    </div>
                                </div>
                            </div>
                            <p className="text-zinc-500">Here are the servers and departments that you are a member of.</p>

                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {serversWithStats.length === 0 ? (
                                    <div className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-3xl bg-[#1a1a1a]/50 text-center space-y-6">
                                        <div className="h-20 w-20 rounded-full bg-zinc-800/50 flex items-center justify-center border border-zinc-700">
                                            <ServerIcon className="h-10 w-10 text-zinc-500" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-bold text-white">No Servers Connected</h3>
                                            <p className="text-zinc-500 max-w-sm mx-auto">
                                                You aren't a member of any servers yet. Connect your PRC server to get started.
                                            </p>
                                        </div>
                                        {canCreateServer && (
                                            <Link 
                                                href="/dashboard/create"
                                                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl transition-all shadow-xl shadow-emerald-500/10 flex items-center gap-2 group scale-100 hover:scale-105 active:scale-95"
                                            >
                                                <Plus className="h-5 w-5 transition-transform group-hover:rotate-90" />
                                                Create My First Server
                                            </Link>
                                        )}
                                    </div>
                                ) : (
                                    serversWithStats.map((server: any) => (
                                        <div key={server.id} className="group relative overflow-hidden rounded-2xl bg-[#1a1a1a] shadow-lg transition-all hover:bg-[#1f1f1f]">
                                            {/* Banner Image with Gradient */}
                                            <div className="h-32 w-full relative group bg-zinc-800">
                                                {server.bannerUrl && server.bannerUrl !== "about:blank" ? (
                                                    <img src={server.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                                ) : (
                                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-zinc-800 group-hover:from-indigo-500 group-hover:via-purple-500 group-hover:to-zinc-700 transition-colors duration-500"></div>
                                                )}
                                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                                            </div>

                                            <div className="p-5">
                                                {/* Server Info */}
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-white">{server.customName || server.name}</h3>
                                                        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                                                            <span className={`inline-block h-2 w-2 rounded-full ${server.stats.online && server.stats.players > 0 ? "bg-emerald-500" : "bg-red-500"}`}></span>
                                                            {server.stats.online && server.stats.players > 0 ? "Online" : "Offline"}
                                                        </div>
                                                    </div>
                                                    <Shield className="h-5 w-5 text-emerald-500" />
                                                </div>

                                                {/* Quick Access */}
                                                <div className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-center text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 cursor-pointer">
                                                    Quick Access: Press ⌘ + Enter
                                                </div>

                                                {/* Stats */}
                                                <div className="mt-4 flex items-center justify-between border-b border-white/5 pb-4">
                                                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                                                        <Users className="h-4 w-4" />
                                                        <span>{server.stats.players ?? 0} players</span>
                                                    </div>
                                                    {/* Avatars placeholder */}
                                                    <div className="flex -space-x-2">
                                                        <div className="h-6 w-6 rounded-full bg-zinc-700 border border-[#1a1a1a]"></div>
                                                        <div className="h-6 w-6 rounded-full bg-zinc-600 border border-[#1a1a1a]"></div>
                                                    </div>
                                                </div>

                                                {/* Links */}
                                                <div className="mt-4 space-y-2">
                                                    <Link href={`/dashboard/${server.id}/admin`} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
                                                        <LayoutDashboard className="h-4 w-4 text-sky-400" />
                                                        Admin Dashboard
                                                    </Link>
                                                    <Link href={`/dashboard/${server.id}/mod-panel`} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
                                                        <Shield className="h-4 w-4 text-emerald-400" />
                                                        Moderator Panel
                                                    </Link>
                                                    <Link href={`/dashboard/${server.id}/forms`} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
                                                        <FileText className="h-4 w-4 text-indigo-400" />
                                                        Forms
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Footer with legal links */}
                        <DashboardFooter />
                    </div>
                </div>
            </div>
        </EnsureDiscordConnection>
    )
}
