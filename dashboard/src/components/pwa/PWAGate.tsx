"use client"

import { useState, useEffect } from "react"
import { Download, Share, Plus, MoreVertical } from "lucide-react"
import { usePWA } from "@/components/providers/pwa-provider"
import { usePathname } from "next/navigation"

/**
 * PWA Gate - Forces mobile users to install the app before using it
 * Blocks the entire UI on mobile browsers until installed as PWA
 */
export function PWAGate({ children }: { children: React.ReactNode }) {
    // Start with null states to ensure server/client match
    const [isMounted, setIsMounted] = useState(false)
    const { isMobile, isInstalled, isIOS, canInstall, install } = usePWA()
    const pathname = usePathname()

    useEffect(() => {
        setIsMounted(true)
    }, [])

    // Server render AND initial client render: always show children
    if (!isMounted) {
        return <>{children}</>
    }

    // After mount: Desktop or already installed - show normal content
    if (!isMobile || isInstalled) {
        return <>{children}</>
    }

    // EXEMPTIONS: Landing Page, Pricing, Form Filling, and Auth flows
    const isLandingPage = pathname === "/"
    const isPricingPage = pathname === "/pricing"
    const isLoginPage = pathname?.startsWith("/login")
    const isVisionAuthPage = pathname?.startsWith("/vision-auth")
    const isFormFillingPage = pathname?.startsWith("/forms/") && !pathname?.startsWith("/forms/editor")

    if (isLandingPage || isPricingPage || isLoginPage || isVisionAuthPage || isFormFillingPage) {
        return <>{children}</>
    }

    // Mobile browser - show install gate
    return (
        <div className="min-h-[100dvh] w-full bg-[#111] flex flex-col items-center justify-center px-4 py-12 text-center overflow-y-auto">
            <div className="flex flex-col items-center w-full max-w-[340px] mx-auto">
                {/* Logo/Icon */}
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/20">
                    <span className="text-3xl font-bold text-white">P</span>
                </div>

                <h1 className="text-2xl font-bold text-white mb-2">Project Overwatch</h1>
                <p className="text-zinc-400 mb-8 text-sm">
                    Installation required for the mobile engine
                </p>

            {/* iOS Instructions */}
            {isIOS && (
                <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a] w-full max-w-sm">
                    <h2 className="text-lg font-bold text-white mb-4">How to Install</h2>

                    <div className="space-y-4">
                        <div className="flex items-start gap-3 text-left">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-indigo-400 font-bold text-sm">1</span>
                            </div>
                            <div>
                                <p className="text-white font-medium">Tap the Share button</p>
                                <p className="text-zinc-500 text-sm flex items-center gap-1">
                                    Look for <Share className="w-4 h-4" /> at the bottom
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 text-left">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-indigo-400 font-bold text-sm">2</span>
                            </div>
                            <div>
                                <p className="text-white font-medium">Add to Home Screen</p>
                                <p className="text-zinc-500 text-sm flex items-center gap-1">
                                    Scroll down and tap <Plus className="w-4 h-4" /> Add to Home Screen
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 text-left">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-indigo-400 font-bold text-sm">3</span>
                            </div>
                            <div>
                                <p className="text-white font-medium">Open the app</p>
                                <p className="text-zinc-500 text-sm">
                                    Find POW on your home screen
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Android Install Button */}
            {!isIOS && (
                <div className="w-full max-w-sm space-y-4">
                    {canInstall ? (
                        <button
                            onClick={install}
                            className="w-full py-4 px-6 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all active:scale-95"
                        >
                            <Download className="w-5 h-5" />
                            Install App
                        </button>
                    ) : (
                        <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a]">
                            <h2 className="text-lg font-bold text-white mb-4">How to Install</h2>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3 text-left">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                        <span className="text-indigo-400 font-bold text-sm">1</span>
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">Open browser menu</p>
                                        <p className="text-zinc-500 text-sm flex items-center gap-1">
                                            Tap <MoreVertical className="w-4 h-4" /> in the top right
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 text-left">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                        <span className="text-indigo-400 font-bold text-sm">2</span>
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">Install app</p>
                                        <p className="text-zinc-500 text-sm flex items-center gap-1">
                                            Tap "Install app" or "Add to Home screen"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <p className="text-zinc-600 text-xs mt-8">
                Optimized specifically for PWA wrappers
            </p>
            </div>
        </div>
    )
}