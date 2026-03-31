"use client"

import { useEffect, useState } from "react"
import { Crown, Zap, Star } from "lucide-react"
import Link from "next/link"

interface PlanInfo {
    plan: string
    forms: number
    automations: number
    hasRaidDetection: boolean
    hasAutoActions: boolean
    hasExports: boolean
    hasVisionAccess: boolean
    hasWhiteLabelBot: boolean
}

export function SubscriptionBanner({ serverId }: { serverId: string }) {
    const [plan, setPlan] = useState<PlanInfo | null>(null)

    useEffect(() => {
        fetch(`/api/server/${serverId}/plan`)
            .then(res => res.json())
            .then(data => setPlan(data))
            .catch(() => { })
    }, [serverId])

    if (!plan || plan.plan !== "free") return null

    return (
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <Star className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="font-semibold text-white">Upgrade to POW Pro</p>
                        <p className="text-sm text-zinc-400">
                            Unlock raid detection, Vision access, and more forms
                        </p>
                    </div>
                </div>
                <Link
                    href="/pricing"
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                    View Plans
                </Link>
            </div>
        </div>
    )
}

export function PlanBadge({ serverId }: { serverId: string }) {
    const [plan, setPlan] = useState<string | null>(null)

    useEffect(() => {
        fetch(`/api/server/${serverId}/plan`)
            .then(res => res.json())
            .then(data => setPlan(data.plan))
            .catch(() => { })
    }, [serverId])

    if (!plan) return null

    const config = {
        "pow-max": { label: "Max", icon: Crown, color: "purple" },
        "pow-pro": { label: "Pro", icon: Zap, color: "blue" },
        "free": { label: "Free", icon: Star, color: "zinc" },
    }[plan] || { label: "Free", icon: Star, color: "zinc" }

    const Icon = config.icon

    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold bg-${config.color}-500/10 text-${config.color}-400 border border-${config.color}-500/20`}>
            <Icon className="h-3 w-3" />
            {config.label}
        </span>
    )
}

export function FeatureGate({
    serverId,
    feature,
    children,
    fallback
}: {
    serverId: string
    feature: "hasRaidDetection" | "hasAutoActions" | "hasExports" | "hasVisionAccess" | "hasWhiteLabelBot"
    children: React.ReactNode
    fallback?: React.ReactNode
}) {
    const [plan, setPlan] = useState<PlanInfo | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`/api/server/${serverId}/plan`)
            .then(res => res.json())
            .then(data => { setPlan(data); setLoading(false) })
            .catch(() => setLoading(false))
    }, [serverId])

    if (loading) return null
    if (!plan) return <>{fallback}</>
    if (plan[feature]) return <>{children}</>

    return <>{fallback || (
        <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 text-center">
            <p className="text-zinc-400 text-sm">This feature requires a Pro or Max subscription</p>
            <Link href="/pricing" className="text-blue-400 hover:text-blue-300 text-sm font-medium mt-2 inline-block">
                Upgrade Now →
            </Link>
        </div>
    )}</>
}

export function LimitIndicator({
    current,
    max,
    label
}: {
    current: number
    max: number
    label: string
}) {
    const isUnlimited = max >= 100_000
    const percentage = isUnlimited ? 0 : (current / max) * 100
    const isNearLimit = !isUnlimited && percentage >= 80
    const isAtLimit = !isUnlimited && current >= max

    return (
        <div className="flex items-center gap-2 text-sm bg-zinc-900 px-3 py-1.5 rounded-lg border border-white/5">
            <span className="text-zinc-400">{label}:</span>
            <span className={`font-medium ${isAtLimit ? "text-red-400" : isNearLimit ? "text-yellow-400" : "text-emerald-400"
                }`}>
                {current} / {isUnlimited ? "Unlimited" : max}
            </span>
        </div>
    )
}

export function SubscriptionPromo({ title, description }: { title: string, description: string }) {
    return (
        <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-zinc-900 border border-blue-500/20 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
                <Crown className="w-32 h-32 text-blue-500" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                        <Zap className="h-5 w-5 text-blue-400" />
                        {title}
                    </h3>
                    <p className="text-zinc-400 text-sm max-w-xl">
                        {description}
                    </p>
                </div>
                <Link
                    href="/dashboard/subscription"
                    className="whitespace-nowrap px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20"
                >
                    Upgrade Plan
                </Link>
            </div>
        </div>
    )
}
