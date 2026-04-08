"use client"

import { useState } from "react"
import { Users, FileText, AlertTriangle, Clock, Wrench, Settings, ChevronLeft } from "lucide-react"
import Link from "next/link"

interface MobileModPanelProps {
    serverId: string
    children: {
        header: React.ReactNode
        shiftSection: React.ReactNode
        players: React.ReactNode
        logs: React.ReactNode
        punishments: React.ReactNode
        toolbox: React.ReactNode
    }
    hasAdminAccess: boolean
    isOnDuty: boolean
    userName: string
}

type TabId = "players" | "logs" | "punishments" | "shifts" | "toolbox"

const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
    { id: "players", label: "Players", icon: Users },
    { id: "logs", label: "Logs", icon: FileText },
    { id: "punishments", label: "Punish", icon: AlertTriangle },
    { id: "shifts", label: "Shifts", icon: Clock },
    { id: "toolbox", label: "Tools", icon: Wrench },
]

export function MobileModPanel({
    serverId,
    children,
    hasAdminAccess,
    isOnDuty,
    userName,
}: MobileModPanelProps) {
    const [activeTab, setActiveTab] = useState<TabId>("players")

    return (
        <div className="flex flex-col h-screen bg-[#111] md:hidden">
            {/* Mobile Header - Fixed */}
            <header className="flex-shrink-0 bg-[#1a1a1a] border-b border-[#222] p-4 pt-safe">
                <div className="flex items-center justify-between relative">
                    {/* Left: Back button */}
                    <Link
                        href="/dashboard"
                        className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                        aria-label="Back to dashboard"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Link>

                    {/* Center: Title and status */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                            <h1 className="text-lg font-bold text-white">Mod Panel</h1>
                            <div className="flex items-center justify-center gap-2 text-xs">
                                <span className={`h-2 w-2 rounded-full ${isOnDuty ? "bg-emerald-500" : "bg-red-500"}`} />
                                <span className={`font-medium ${isOnDuty ? "text-emerald-400" : "text-red-400"}`}>
                                    {isOnDuty ? "On Duty" : "Off Duty"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Admin button or empty space */}
                    {hasAdminAccess ? (
                        <Link
                            href={`/dashboard/${serverId}/admin`}
                            className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                            aria-label="Admin settings"
                        >
                            <Settings className="h-5 w-5" />
                        </Link>
                    ) : (
                        <div className="w-9" /> /* Spacer to balance layout */
                    )}
                </div>
            </header>

            {/* Content Area - Scrollable */}
            <main className="flex-1 overflow-y-auto pb-20">
                {activeTab === "players" && (
                    <div className="h-full flex flex-col">
                        <div className="p-4 border-b border-[#222]">
                            <h2 className="text-lg font-bold text-white">Players</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {children.players}
                        </div>
                    </div>
                )}
                {activeTab === "logs" && (
                    <div className="h-full flex flex-col">
                        <div className="p-4 border-b border-[#222]">
                            <h2 className="text-lg font-bold text-white">Live Logs</h2>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            {children.logs}
                        </div>
                    </div>
                )}
                {activeTab === "punishments" && (
                    <div className="h-full flex flex-col">
                        <div className="p-4 border-b border-[#222]">
                            <h2 className="text-lg font-bold text-white">Punishments</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {children.punishments}
                        </div>
                    </div>
                )}
                {activeTab === "shifts" && (
                    <div className="h-full flex flex-col">
                        <div className="p-4 border-b border-[#222]">
                            <h2 className="text-lg font-bold text-white">Shifts</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            {children.shiftSection}
                        </div>
                    </div>
                )}
                {activeTab === "toolbox" && (
                    <div className="h-full flex flex-col">
                        <div className="p-4 border-b border-[#222]">
                            <h2 className="text-lg font-bold text-white">Toolbox</h2>
                        </div>
                        <div className="p-4">
                            {children.toolbox}
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Tab Bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-[#222] pb-safe md:hidden">
                <div className="flex items-center justify-around h-16">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id
                        const Icon = tab.icon

                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${isActive
                                    ? "text-indigo-400"
                                    : "text-zinc-500"
                                    }`}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                                <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
                            </button>
                        )
                    })}
                </div>
            </nav>
        </div>
    )
}
