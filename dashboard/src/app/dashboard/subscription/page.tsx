"use client"

import { useEffect, useState } from "react"
import { Crown, Zap, Star, Check, Link2, Unlink, Loader2, ChevronRight, ArrowLeft, Server } from "lucide-react"
import Link from "next/link"
import { useClerk } from "@clerk/nextjs"

interface ServerOption {
    id: string
    name: string
    currentPlan: string
    isLinkedToMe: boolean
}

interface SubscriptionData {
    userPlan: string
    linkedServerId?: string
    servers: ServerOption[]
    isSuperAdmin?: boolean
}

export default function SubscriptionPage() {
    const { openUserProfile } = useClerk()
    const [data, setData] = useState<SubscriptionData | null>(null)
    const [loading, setLoading] = useState(true)
    const [linking, setLinking] = useState(false)
    const [selectedServer, setSelectedServer] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    useEffect(() => {
        // Check for success
        const params = new URLSearchParams(window.location.search)
        if (params.get("success")) {
            setSuccessMessage("Subscription activated successfully! It may take a moment to reflect.")
            // Clean up URL
            window.history.replaceState({}, '', '/dashboard/subscription')
        }

        fetch("/api/subscription/link")
            .then(res => res.json())
            .then(d => {
                setData(d)
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    const handleLink = async (serverId: string) => {
        setLinking(true)
        setSelectedServer(serverId)

        try {
            const res = await fetch("/api/subscription/link", {
                method: "POST",
                headers: { "x-csrf-check": "1", "Content-Type": "application/json" },
                body: JSON.stringify({ serverId, plan: data?.userPlan })
            })

            if (res.ok) {
                // Refresh data
                const updated = await fetch("/api/subscription/link").then(r => r.json())
                setData(updated)
            }
        } catch (e) {
            console.error("Failed to link:", e)
        } finally {
            setLinking(false)
            setSelectedServer(null)
        }
    }

    const handleUnlink = async (serverIdToUnlink: string) => {
        setLinking(true)

        try {
            const res = await fetch(`/api/subscription/link?serverId=${serverIdToUnlink}`, { method: "DELETE", headers: { "x-csrf-check": "1" } })
            if (res.ok) {
                const updated = await fetch("/api/subscription/link").then(r => r.json())
                setData(updated)
            }
        } catch (e) {
            console.error("Failed to unlink:", e)
        } finally {
            setLinking(false)
        }
    }

    const handleManageBilling = () => {
        openUserProfile()
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        )
    }

    const linkedServers = data?.servers.filter(s => s.isLinkedToMe) || []
    const hasUserPlan = data?.userPlan === "pow-pro-user"
    const hasServerPlan = data?.userPlan === "pow-pro" || data?.userPlan === "pow-max"
    const hasAnyPlan = hasUserPlan || hasServerPlan
    const isSuperAdmin = data?.isSuperAdmin

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            {/* Header */}
            <header className="border-b border-[#222]">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Dashboard
                    </Link>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-12">
                <h1 className="text-3xl font-bold mb-2">Your Subscription</h1>
                <p className="text-zinc-400 mb-8">Manage your POW subscription and link it to a server</p>

                {successMessage && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl mb-8 flex items-center gap-3">
                        <Check className="h-5 w-5" />
                        {successMessage}
                    </div>
                )}

                {/* Current Plan */}
                <div className="bg-[#1a1a1a] rounded-2xl border border-[#333] p-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className={`h-14 w-14 rounded-xl flex items-center justify-center ${hasAnyPlan ? "bg-blue-500/10" : "bg-zinc-500/10"
                            }`}>
                            {hasAnyPlan
                                ? <Zap className="h-7 w-7 text-blue-400" />
                                : <Star className="h-7 w-7 text-zinc-400" />
                            }
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold">
                                {data?.userPlan === "pow-max" ? "POW Max" :
                                 data?.userPlan === "pow-pro" ? "POW Pro" :
                                 data?.userPlan === "pow-pro-user" ? "POW Pro User" : "Free"}
                                 {isSuperAdmin && <span className="ml-2 text-xs bg-amber-500/20 text-amber-500 px-2 py-1 rounded-full uppercase tracking-wider">Superadmin (Infinite)</span>}
                            </h2>
                            <p className="text-zinc-400 text-sm">
                                {hasUserPlan ? "Personal subscription with Vision access" :
                                 hasServerPlan ? "Server subscription with premium features" :
                                 "Upgrade to unlock premium features"}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {!hasAnyPlan ? (
                                <Link
                                    href="/pricing"
                                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
                                >
                                    Upgrade
                                </Link>
                            ) : (
                                <button
                                    onClick={handleManageBilling}
                                    disabled={linking}
                                    className="px-4 py-2 border border-[#333] hover:bg-white/5 text-white font-semibold rounded-lg transition-colors"
                                >
                                    Manage Billing
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Linked Servers */}
                {linkedServers.length > 0 && (
                    <div className="mb-8 space-y-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Link2 className="h-5 w-5 text-purple-400" />
                            Linked Servers {isSuperAdmin && `(${linkedServers.length})`}
                        </h2>
                        {linkedServers.map(server => (
                            <div key={server.id} className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/20 p-5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center font-bold text-purple-400">
                                        {server.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">{server.name}</h3>
                                        <p className="text-xs text-purple-300">Currently receiving {data?.userPlan} benefits</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleUnlink(server.id)}
                                    disabled={linking}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold rounded-lg transition-colors border border-red-500/20"
                                >
                                    {linking && selectedServer === server.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                                    Unlink
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Available Servers */}
                <div className="bg-[#1a1a1a] rounded-2xl border border-[#333] overflow-hidden">
                    <div className="p-6 border-b border-[#222]">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Server className="h-5 w-5 text-zinc-400" />
                            {linkedServers.length > 0 && !isSuperAdmin ? "Change Linked Server" : "Link Your Subscription"}
                        </h2>
                        <p className="text-zinc-400 text-sm mt-1">
                            {isSuperAdmin ? "As a superadmin, you can link to an unlimited number of servers." : "Select a server to receive your subscription benefits."}
                        </p>
                    </div>

                    {(data?.servers || []).length === 0 ? (
                        <div className="p-8 text-center text-zinc-500">
                            You're not a member of any servers yet
                        </div>
                    ) : (
                        <div className="divide-y divide-[#222]">
                            {data?.servers.map((server) => {
                                // If they aren't superadmin and have a linked server, and this ISN'T the linked server, they can click "Link" to swap it.
                                // If they are superadmin, they can link as many as they want.
                                const canLink = isSuperAdmin ? !server.isLinkedToMe : true;

                                return (
                                <div
                                    key={server.id}
                                    className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold">
                                            {server.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white">{server.name}</p>
                                            <p className="text-xs text-zinc-500">
                                                Current: {server.currentPlan === "free" ? "Free" : server.currentPlan.toUpperCase()}
                                            </p>
                                        </div>
                                    </div>

                                    {server.isLinkedToMe ? (
                                        <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
                                            <Check className="h-4 w-4" />
                                            Linked
                                        </span>
                                    ) : canLink ? (
                                        <button
                                            onClick={() => handleLink(server.id)}
                                            disabled={linking || !hasAnyPlan}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {linking && selectedServer === server.id
                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                : <Link2 className="h-4 w-4" />
                                            }
                                            Link
                                        </button>
                                    ) : null}
                                </div>
                            )})}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
