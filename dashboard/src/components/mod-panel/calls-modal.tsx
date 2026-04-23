"use client"

import { useEffect, useState } from "react"
import { X, Phone, ShieldAlert, Clock, MapPin, Loader2, RefreshCw } from "lucide-react"
import { useServerEventsContext } from "@/components/providers/server-events-provider"

interface Call {
    id: string
    callerName?: string | null
    callerId: string
    description?: string | null
    callNumber?: number | null
    positionX?: number | null
    positionZ?: number | null
    positionDescriptor?: string | null
    timestamp?: number | null
    team?: string // For emergency calls
}

export function CallsModal({ serverId, onClose }: { serverId: string, onClose: () => void }) {
    const { calls, connected } = useServerEventsContext()

    const modCalls: Call[] = calls?.modCalls ?? []
    const emergencyCalls: Call[] = calls?.emergencyCalls ?? []
    const [refreshing, setRefreshing] = useState(false)

    // Manual refresh still available as a fallback — force-refetch from the REST endpoint
    // and update via normal fetch (SSE will re-deliver updated data on next sync anyway)
    const handleRefresh = async () => {
        setRefreshing(true)
        try {
            const res = await fetch(`/api/calls?serverId=${serverId}`)
            // We just trigger it to update the DB; SSE will push new data
        } catch { /* silent */ } finally {
            setTimeout(() => setRefreshing(false), 600)
        }
    }

    const formatTime = (ts?: number | null) => {
        if (!ts) return "–"
        const date = new Date(ts * 1000)
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const loading = !calls && !connected

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[80vh] bg-[#1a1a1a] rounded-2xl border border-[#333] shadow-2xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-[#222] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                            <Phone className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white">Active Calls</h3>
                            <p className="text-xs text-zinc-500 mt-0.5">Moderator &amp; Emergency Calls</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            aria-label="Refresh calls"
                            onClick={handleRefresh}
                            className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                            title="Refresh"
                        >
                            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            aria-label="Close calls modal"
                            onClick={onClose}
                            className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2">
                    {/* Mod Calls */}
                    <div className="border-r border-[#222] flex flex-col h-full overflow-hidden">
                        <div className="p-4 bg-zinc-900/50 border-b border-[#222] flex items-center justify-between">
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                <ShieldAlert className="h-3 w-3 text-amber-400" />
                                Mod Calls
                            </h4>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold">{modCalls.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {loading ? (
                                <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-700" /></div>
                            ) : modCalls.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-xs text-zinc-600">No active mod calls</div>
                            ) : (
                                modCalls.map(call => (
                                    <div key={call.id} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="font-bold text-amber-400">{call.callNumber}</span>
                                            <span className="text-zinc-500 flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTime(call.timestamp)}</span>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-white mb-0.5">{call.callerName}</p>
                                            <p className="text-xs text-zinc-400 line-clamp-2">{call.description}</p>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 bg-black/30 p-1.5 rounded-lg border border-white/5">
                                            <MapPin className="h-3 w-3 text-amber-500/50" />
                                            <span className="truncate">{call.positionDescriptor || "Location Data Unavailable"}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Emergency Calls */}
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="p-4 bg-zinc-900/50 border-b border-[#222] flex items-center justify-between">
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                <Phone className="h-3 w-3 text-red-500" />
                                911 / EMS
                            </h4>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 font-bold">{emergencyCalls.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {loading ? (
                                <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-700" /></div>
                            ) : emergencyCalls.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-xs text-zinc-600">No active 911 calls</div>
                            ) : (
                                emergencyCalls.map(call => (
                                    <div key={call.id} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="font-bold text-red-500">{call.team} {call.callNumber}</span>
                                            <span className="text-zinc-500 flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTime(call.timestamp)}</span>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-white mb-0.5">{call.callerName}</p>
                                            <p className="text-xs text-zinc-400 line-clamp-2">{call.description}</p>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-white bg-blue-600/20 p-1.5 rounded-lg border border-blue-500/20">
                                            <MapPin className="h-3 w-3 text-blue-400" />
                                            <span className="font-medium truncate">{call.positionDescriptor || (call.team === 'Fire / EMS' ? 'EMS' : '911') + ' Location Recorded'}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
