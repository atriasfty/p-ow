"use client"

import { useEffect, useState, use } from "react"
import { Crown, Zap, Star, Check, Link2, Unlink, Loader2, ChevronRight, Server, Shield } from "lucide-react"
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

export default function AdminSubscriptionPage({ params: paramsPromise }: { params: Promise<{ serverId: string }> }) {
    const params = use(paramsPromise)
    const { openUserProfile } = useClerk()
    const [data, setData] = useState<SubscriptionData | null>(null)
    const [loading, setLoading] = useState(true)
    const [linking, setLinking] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        fetchData()
    }, [params.serverId])

    const fetchData = async () => {
        try {
            const res = await fetch("/api/subscription/link")
            const d = await res.json()
            setData(d)
        } catch (e) {
            console.error("Failed to load subscription data", e)
        } finally {
            setLoading(false)
        }
    }

    const handleLink = async () => {
        setLinking(true)
        setMessage(null)

        try {
            const res = await fetch("/api/subscription/link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serverId: params.serverId, plan: data?.userPlan })
            })

            if (res.ok) {
                setMessage({ type: 'success', text: "Subscription linked successfully!" })
                fetchData()
            } else {
                const err = await res.json()
                setMessage({ type: 'error', text: err.error || "Failed to link subscription" })
            }
        } catch (e) {
            setMessage({ type: 'error', text: "An error occurred" })
        } finally {
            setLinking(false)
        }
    }

    const handleUnlink = async () => {
        setLinking(true)
        setMessage(null)

        try {
            const res = await fetch(`/api/subscription/link?serverId=${params.serverId}`, { method: "DELETE" })
            if (res.ok) {
                setMessage({ type: 'success', text: "Subscription unlinked." })
                fetchData()
            }
        } catch (e) {
            setMessage({ type: 'error', text: "An error occurred" })
        } finally {
            setLinking(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        )
    }

    const currentServer = data?.servers.find(s => s.id === params.serverId)
    const isLinked = currentServer?.isLinkedToMe
    const hasUserPlan = data?.userPlan === "pow-pro-user"
    const hasServerPlan = data?.userPlan === "pow-pro" || data?.userPlan === "pow-max"
    const hasAnyPlan = hasUserPlan || hasServerPlan
    const isSuperAdmin = data?.isSuperAdmin

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="bg-[#1a1a1a] rounded-xl border border-[#222] overflow-hidden">
                <div className="p-6 border-b border-[#222]">
                    <h1 className="text-2xl font-bold text-white mb-2">Server Subscription</h1>
                    <p className="text-zinc-400 text-sm">Manage the premium status of this server.</p>
                </div>

                <div className="p-6 space-y-8">
                    {message && (
                        <div className={`p-4 rounded-lg flex items-center gap-3 ${
                            message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                            <Check className="h-5 w-5" />
                            {message.text}
                        </div>
                    )}

                    {/* Current Plan Status */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[#222] rounded-xl p-6 border border-[#333]">
                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Your Plan</p>
                            <div className="flex items-center gap-4">
                                <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${hasAnyPlan ? "bg-indigo-500/10" : "bg-zinc-500/10"}`}>
                                    {hasAnyPlan ? <Zap className="h-6 w-6 text-indigo-400" /> : <Star className="h-6 w-6 text-zinc-400" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">
                                        {data?.userPlan === "pow-max" ? "POW Max" :
                                         data?.userPlan === "pow-pro" ? "POW Pro" :
                                         data?.userPlan === "pow-pro-user" ? "POW Pro User" : "Free"}
                                    </h3>
                                    <p className="text-xs text-zinc-500">
                                        {hasAnyPlan ? "Active Subscription" : "No active subscription"}
                                    </p>
                                </div>
                            </div>
                            {!hasAnyPlan && (
                                <Link href="/pricing" className="mt-6 block text-center py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all">
                                    View Plans
                                </Link>
                            )}
                        </div>

                        <div className="bg-[#222] rounded-xl p-6 border border-[#333]">
                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Server Status</p>
                            <div className="flex items-center gap-4">
                                <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${currentServer?.currentPlan !== 'free' ? "bg-emerald-500/10" : "bg-zinc-500/10"}`}>
                                    <Server className={`h-6 w-6 ${currentServer?.currentPlan !== 'free' ? "text-emerald-400" : "text-zinc-400"}`} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg uppercase">
                                        {currentServer?.currentPlan || "Free"}
                                    </h3>
                                    <p className="text-xs text-zinc-500">
                                        Current Tier
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Linking Controls */}
                    <div className="pt-6 border-t border-[#333]">
                        <h3 className="text-lg font-bold text-white mb-4">Manage Link</h3>
                        
                        {isSuperAdmin ? (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-4 mb-6">
                                <Shield className="h-8 w-8 text-amber-500" />
                                <div>
                                    <p className="text-amber-400 font-bold">Super Admin Access</p>
                                    <p className="text-xs text-amber-400/70">You can link this server to your subscription without affecting other linked servers.</p>
                                </div>
                            </div>
                        ) : null}

                        {isLinked ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                                    <p className="text-sm text-emerald-400 flex items-center gap-2">
                                        <Check className="h-4 w-4" /> This server is currently linked to your subscription.
                                    </p>
                                </div>
                                <button
                                    onClick={handleUnlink}
                                    disabled={linking}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-bold border border-red-500/20 transition-all"
                                >
                                    {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                                    Unlink Subscription
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-zinc-400">
                                    {hasAnyPlan 
                                        ? "Link your subscription to this server to unlock premium features including higher API limits, automations, and more."
                                        : "You need an active subscription to link a server. Check out our plans to get started."
                                    }
                                </p>
                                <button
                                    onClick={handleLink}
                                    disabled={linking || !hasAnyPlan}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                                >
                                    {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                                    Link My Subscription
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
