
"use client"

import { useState, useEffect } from "react"
import { Sparkles, X, ArrowRight } from "lucide-react"
import Link from "next/link"

interface UpsellBannerProps {
    serverId: string
    plan: string | null
    feature: string
    title: string
    description: string
    storageKey: string
}

export function UpsellBanner({ serverId, plan, feature, title, description, storageKey }: UpsellBannerProps) {
    const [dismissed, setDismissed] = useState(true)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        const dismissalTime = localStorage.getItem(`upsell_dismissed_${storageKey}_${serverId}`)
        
        if (dismissalTime) {
            const lastDismissed = parseInt(dismissalTime)
            const twentyFourHours = 24 * 60 * 60 * 1000
            
            // If it was dismissed more than 24h ago, show it again
            if (Date.now() - lastDismissed > twentyFourHours) {
                if (!plan || plan === 'free') {
                    setDismissed(false)
                }
            }
        } else {
            // Never dismissed before
            if (!plan || plan === 'free') {
                setDismissed(false)
            }
        }
    }, [serverId, plan, storageKey])

    const handleDismiss = () => {
        localStorage.setItem(`upsell_dismissed_${storageKey}_${serverId}`, Date.now().toString())
        setDismissed(true)
    }

    if (!mounted || dismissed) return null

    return (
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600/10 via-purple-600/10 to-indigo-600/10 border border-indigo-500/20 rounded-xl p-4 mb-6 group transition-all hover:border-indigo-500/40">
            <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5 text-indigo-400" />
                </div>
                
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {title}
                        <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Pro Feature
                        </span>
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        {description}
                    </p>
                    <div className="mt-3 flex items-center gap-4">
                        <Link 
                            href="/pricing"
                            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 group/btn"
                        >
                            View Plans & Upgrade
                            <ArrowRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-1" />
                        </Link>
                        <button 
                            onClick={handleDismiss}
                            className="text-[10px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>

                <button 
                    onClick={handleDismiss}
                    aria-label="Dismiss banner"
                    title="Dismiss banner"
                    className="absolute top-2 right-2 p-1 text-zinc-600 hover:text-zinc-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            
            {/* Animated background flare */}
            <div className="absolute -inset-y-12 -inset-x-12 bg-indigo-500/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </div>
    )
}
