'use client'

import { useState, useEffect } from 'react'
import { Power, X } from 'lucide-react'

interface SsdEvent {
    timestamp: string
    initiatedBy: string
    shiftsEnded: number
}

export function SsdNotification({ serverId }: { serverId: string }) {
    const [ssdEvent, setSsdEvent] = useState<SsdEvent | null>(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const checkSsd = async () => {
            try {
                const res = await fetch(`/api/ssd-check?serverId=${serverId}`, {
                    cache: 'no-store'
                })
                const data = await res.json()

                if (data.ssd) {
                    setSsdEvent(data.ssd)
                    setIsVisible(true)
                }
            } catch (e) {
                // Silently fail
            }
        }

        checkSsd()

        // Poll every 10 seconds
        const interval = setInterval(checkSsd, 10000)
        return () => clearInterval(interval)
    }, [serverId])

    const handleDismiss = async () => {
        setIsVisible(false)

        // Acknowledge on server - pass event timestamp for per-user tracking
        try {
            await fetch('/api/ssd-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId, eventTimestamp: ssdEvent?.timestamp })
            })
        } catch (e) {
            // Silently fail
        }
    }

    if (!isVisible || !ssdEvent) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-red-500/30 overflow-hidden shadow-2xl shadow-red-500/10 animate-in zoom-in-95 duration-200">
                <div className="p-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-red-500/10 text-red-500">
                                <Power className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Server Shutdown (SSD)</h3>
                        </div>
                        <button
                            onClick={handleDismiss}
                            aria-label="Dismiss notification"
                            className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6">
                        <p className="text-red-300 text-sm font-medium mb-2">
                            Your shift has been automatically ended
                        </p>
                        <p className="text-zinc-400 text-sm">
                            The server was shut down by <span className="text-white font-medium">{ssdEvent.initiatedBy}</span>.
                            All {ssdEvent.shiftsEnded} active shift{ssdEvent.shiftsEnded !== 1 ? 's were' : ' was'} ended automatically.
                        </p>
                    </div>

                    <p className="text-zinc-500 text-xs mb-6">
                        Your shift time has been saved. You can start a new shift when the server is back online.
                    </p>

                    {/* Button */}
                    <button
                        onClick={handleDismiss}
                        className="w-full px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-all transform active:scale-[0.98] bg-red-500 hover:bg-red-600 text-white shadow-red-500/20"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    )
}
