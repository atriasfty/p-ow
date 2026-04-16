"use client"

import { useEffect, useState } from "react"
import { Crown, Zap, Star, Shield, Server, User, Loader2, ArrowLeft, Search, Check } from "lucide-react"
import Link from "next/link"
import { useDialog } from "@/components/providers/dialog-provider"

interface ServerData {
    id: string
    name: string
    plan: string
    subscriberUserId: string | null
    memberCount: number
    formCount: number
}

export default function AdminSubscriptionsPage() {
    const [servers, setServers] = useState<ServerData[]>([])
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState<string | null>(null)
    const [search, setSearch] = useState("")
    const [userIdInput, setUserIdInput] = useState("")
    const [userPlanUpdating, setUserPlanUpdating] = useState(false)
    const { showAlert } = useDialog()

    useEffect(() => {
        fetchServers()
    }, [])

    const fetchServers = async () => {
        try {
            const res = await fetch("/api/admin/subscriptions")
            if (res.ok) {
                const data = await res.json()
                setServers(data.servers || [])
            }
        } catch (e) {
            console.error("Failed to fetch servers:", e)
        } finally {
            setLoading(false)
        }
    }

    const updateServerPlan = async (serverId: string, plan: string) => {
        setUpdating(serverId)
        try {
            await fetch("/api/admin/subscriptions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-csrf-check": "1" },
                body: JSON.stringify({ type: "server", targetId: serverId, plan })
            })
            await fetchServers()
        } catch (e) {
            console.error("Failed to update:", e)
        } finally {
            setUpdating(null)
        }
    }

    const grantUserPlan = async () => {
        if (!userIdInput.trim()) return
        setUserPlanUpdating(true)
        try {
            await fetch("/api/admin/subscriptions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-csrf-check": "1" },
                body: JSON.stringify({ type: "user", targetId: userIdInput.trim(), plan: "pow-pro-user" })
            })
            setUserIdInput("")
            await showAlert("Success", "User plan granted!", "success")
        } catch (e) {
            console.error("Failed to grant user plan:", e)
        } finally {
            setUserPlanUpdating(false)
        }
    }

    const filteredServers = servers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    )

    const getPlanIcon = (plan: string) => {
        switch (plan) {
            case "pow-max": return <Crown className="h-4 w-4 text-purple-400" />
            case "pow-pro": return <Zap className="h-4 w-4 text-blue-400" />
            default: return <Star className="h-4 w-4 text-zinc-400" />
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            {/* Header */}
            <header className="border-b border-[#222] bg-red-500/5">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Dashboard
                    </Link>
                    <div className="flex-1" />
                    <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                        <Shield className="h-4 w-4" />
                        Superadmin
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-12">
                <h1 className="text-3xl font-bold mb-2">Subscription Management</h1>
                <p className="text-zinc-400 mb-8">Manually grant or revoke subscriptions</p>

                {/* Grant User Pro */}
                <div className="bg-[#1a1a1a] rounded-2xl border border-[#333] p-6 mb-8">
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <User className="h-5 w-5 text-blue-400" />
                        Grant Pro User
                    </h2>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            placeholder="Clerk User ID (e.g., user_2abc123)"
                            value={userIdInput}
                            onChange={(e) => setUserIdInput(e.target.value)}
                            className="flex-1 bg-[#222] border border-[#333] rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                        />
                        <button
                            onClick={grantUserPlan}
                            disabled={userPlanUpdating || !userIdInput.trim()}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                        >
                            {userPlanUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grant Pro User"}
                        </button>
                    </div>
                </div>

                {/* Server List */}
                <div className="bg-[#1a1a1a] rounded-2xl border border-[#333] overflow-hidden">
                    <div className="p-6 border-b border-[#222] flex items-center gap-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Server className="h-5 w-5 text-zinc-400" />
                            Server Subscriptions
                        </h2>
                        <div className="flex-1" />
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Search servers..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-[#222] border border-[#333] rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                            />
                        </div>
                    </div>

                    <div className="divide-y divide-[#222]">
                        {filteredServers.map((server) => (
                            <div
                                key={server.id}
                                className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors"
                            >
                                <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-zinc-400">
                                    {server.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-white truncate">{server.name}</p>
                                    <p className="text-xs text-zinc-500">
                                        {server.memberCount} members · {server.formCount} forms
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-zinc-800 text-xs font-medium">
                                    {getPlanIcon(server.plan)}
                                    {server.plan === "free" ? "Free" : server.plan.replace("pow-", "").toUpperCase()}
                                </div>
                                <div className="flex items-center gap-2">
                                    {["free", "pow-pro", "pow-max"].map((plan) => (
                                        <button
                                            key={plan}
                                            onClick={() => updateServerPlan(server.id, plan)}
                                            disabled={updating === server.id || server.plan === plan}
                                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${server.plan === plan
                                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                                }`}
                                        >
                                            {updating === server.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : server.plan === plan ? (
                                                <Check className="h-3 w-3" />
                                            ) : (
                                                plan === "free" ? "Free" : plan.replace("pow-", "").toUpperCase()
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    )
}
