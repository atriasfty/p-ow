"use client"

import React, { useState } from "react"
import { Command, Calendar, X, Send, Loader2, Check, Terminal, ClipboardList, Bell, ChevronRight, Phone, Map } from "lucide-react"
import { usePermissions } from "@/components/auth/role-sync-wrapper"
import { CallsModal } from "./calls-modal"
import { MapModal } from "./map-modal"

interface MobileToolboxProps {
    serverId: string
    isOnLoa?: boolean
    featureLoa?: boolean
    featureStaffReq?: boolean
    featurePermLog?: boolean
}

export function MobileToolbox({
    serverId,
    isOnLoa,
    featureLoa = true,
    featureStaffReq = true,
    featurePermLog = true
}: MobileToolboxProps) {
    const [loaOpen, setLoaOpen] = useState(false)
    const [commandOpen, setCommandOpen] = useState(false)
    const [permLogOpen, setPermLogOpen] = useState(false)
    const [staffRequestOpen, setStaffRequestOpen] = useState(false)
    const [callsOpen, setCallsOpen] = useState(false)
    const [mapOpen, setMapOpen] = useState(false)

    // LOA form state
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [reason, setReason] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [loaMessage, setLoaMessage] = useState("")

    // Command state
    const [commandInput, setCommandInput] = useState("")
    const [commandLoading, setCommandLoading] = useState(false)
    const [commandMessage, setCommandMessage] = useState<{ type: "success" | "error", text: string } | null>(null)

    // Perm Log state
    const [permLogData, setPermLogData] = useState({ permission: "", usernames: "", time: "" })
    const [permLogLoading, setPermLogLoading] = useState(false)
    const [permLogMessage, setPermLogMessage] = useState<{ type: "success" | "error", text: string } | null>(null)

    // Staff Request state
    const [staffRequestReason, setStaffRequestReason] = useState("")
    const [staffRequestLoading, setStaffRequestLoading] = useState(false)
    const [staffRequestMessage, setStaffRequestMessage] = useState<{ type: "success" | "error", text: string } | null>(null)

    const { permissions } = usePermissions()

    const handlePermLogSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!permLogData.permission || !permLogData.usernames || !permLogData.time) return

        setPermLogLoading(true)
        setPermLogMessage(null)

        try {
            const res = await fetch("/api/perm-log", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-csrf-check": "1"
                },
                body: JSON.stringify({ serverId, ...permLogData })
            })

            if (res.ok) {
                setPermLogMessage({ type: "success", text: "Permission logged correctly!" })
                setPermLogData({ permission: "", usernames: "", time: "" })
                setTimeout(() => {
                    setPermLogOpen(false)
                    setPermLogMessage(null)
                }, 1500)
            } else {
                const data = await res.json()
                setPermLogMessage({ type: "error", text: data.error || "Failed to log permission" })
            }
        } catch (e) {
            setPermLogMessage({ type: "error", text: "Error logging permission" })
        } finally {
            setPermLogLoading(false)
        }
    }

    const handleLoaSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!startDate || !endDate || !reason.trim()) return

        setSubmitting(true)
        setLoaMessage("")

        try {
            const res = await fetch("/api/loa", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serverId, startDate, endDate, reason: reason.trim() })
            })

            if (res.ok) {
                setLoaMessage("LOA request submitted! Awaiting admin approval.")
                setStartDate("")
                setEndDate("")
                setReason("")
                setTimeout(() => setLoaOpen(false), 2000)
            } else {
                const data = await res.json()
                setLoaMessage(data.error || "Failed to submit request")
            }
        } catch (e) {
            setLoaMessage("Error submitting request")
        } finally {
            setSubmitting(false)
        }
    }

    const handleCommandSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!commandInput.trim()) return

        setCommandLoading(true)
        setCommandMessage(null)

        try {
            const res = await fetch("/api/command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serverId, command: commandInput.trim() })
            })

            if (res.ok) {
                setCommandMessage({ type: "success", text: "Command executed successfully!" })
                setCommandInput("")
                setTimeout(() => {
                    setCommandOpen(false)
                    setCommandMessage(null)
                }, 1500)
            } else {
                const data = await res.json()
                setCommandMessage({ type: "error", text: data.error || "Failed to execute command" })
            }
        } catch (e) {
            setCommandMessage({ type: "error", text: "Error executing command" })
        } finally {
            setCommandLoading(false)
        }
    }

    const handleStaffRequestSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        setStaffRequestLoading(true)
        setStaffRequestMessage(null)

        try {
            const res = await fetch("/api/staff-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serverId, reason: staffRequestReason.trim() })
            })

            if (res.ok) {
                const data = await res.json()
                setStaffRequestMessage({
                    type: "success",
                    text: `Staff request sent! ${data.staffNotified} staff notified in-game.`
                })
                setStaffRequestReason("")
                setTimeout(() => {
                    setStaffRequestOpen(false)
                    setStaffRequestMessage(null)
                }, 2000)
            } else {
                const data = await res.json()
                setStaffRequestMessage({ type: "error", text: data.error || "Failed to send staff request" })
            }
        } catch (e) {
            setStaffRequestMessage({ type: "error", text: "Error sending staff request" })
        } finally {
            setStaffRequestLoading(false)
        }
    }

    // Tool buttons data
    const tools = [
        {
            id: "permlog",
            name: "Perm Log",
            description: "Record permission usage",
            icon: ClipboardList,
            colorClass: "text-blue-400",
            bgClass: "bg-blue-500/10",
            borderClass: "border-blue-500/20",
            show: permissions.canUseToolbox && featurePermLog,
            onClick: () => setPermLogOpen(true),
        },
        {
            id: "command",
            name: "Run Command",
            description: "Execute server commands",
            icon: Terminal,
            colorClass: "text-emerald-400",
            bgClass: "bg-emerald-500/10",
            borderClass: "border-emerald-500/20",
            show: permissions.canUseToolbox,
            onClick: () => setCommandOpen(true),
        },
        {
            id: "loa",
            name: isOnLoa ? "On LOA" : "Request LOA",
            description: isOnLoa ? "Currently on leave" : "Request time off",
            icon: isOnLoa ? Check : Calendar,
            colorClass: isOnLoa ? "text-zinc-500" : "text-orange-400",
            bgClass: isOnLoa ? "bg-zinc-500/10" : "bg-orange-500/10",
            borderClass: isOnLoa ? "border-zinc-500/20" : "border-orange-500/20",
            show: permissions.canRequestLoa && featureLoa,
            onClick: () => !isOnLoa && setLoaOpen(true),
            disabled: isOnLoa,
        },
        {
            id: "staffrequest",
            name: "Staff Request",
            description: "Alert all available staff",
            icon: Bell,
            colorClass: "text-red-400",
            bgClass: "bg-red-500/10",
            borderClass: "border-red-500/20",
            show: permissions.canUseToolbox && featureStaffReq,
            onClick: () => setStaffRequestOpen(true),
        },
        {
            id: "calls",
            name: "Live Calls",
            description: "View emergency & mod calls",
            icon: Phone,
            colorClass: "text-indigo-400",
            bgClass: "bg-indigo-500/10",
            borderClass: "border-indigo-500/20",
            show: true,
            onClick: () => setCallsOpen(true),
        },
        {
            id: "map",
            name: "Real-time Map",
            description: "Satellite player tracking",
            icon: Map,
            colorClass: "text-indigo-400",
            bgClass: "bg-indigo-500/10",
            borderClass: "border-indigo-500/20",
            show: true,
            onClick: () => setMapOpen(true),
        },
    ]

    return (
        <>
            {/* Vertically stacked tool buttons */}
            <div className="space-y-3">
                {tools.filter(t => t.show).map((tool) => {
                    const Icon = tool.icon
                    return (
                        <button
                            key={tool.id}
                            onClick={tool.onClick}
                            disabled={tool.disabled}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl ${tool.bgClass} border ${tool.borderClass} ${tool.disabled ? "opacity-50" : "active:scale-[0.98]"} transition-all`}
                        >
                            <div className={`h-10 w-10 rounded-xl ${tool.bgClass} flex items-center justify-center`}>
                                <Icon className={`h-5 w-5 ${tool.colorClass}`} />
                            </div>
                            <div className="flex-1 text-left">
                                <p className={`font-semibold ${tool.colorClass}`}>{tool.name}</p>
                                <p className="text-xs text-zinc-500">{tool.description}</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-zinc-600" />
                        </button>
                    )
                })}
            </div>

            {/* Perm Log Modal */}
            {permLogOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#1a1a1a] rounded-t-2xl border-t border-l border-r border-[#333] overflow-hidden shadow-2xl animate-in slide-in-from-bottom">
                        <div className="p-6 border-b border-[#222] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                    <ClipboardList className="h-5 w-5 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">Log Permission</h3>
                                    <p className="text-xs text-zinc-500">Record a permission usage</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setPermLogOpen(false); setPermLogMessage(null) }}
                                aria-label="Close Permission Log"
                                className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handlePermLogSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">Permission</label>
                                <input
                                    type="text"
                                    value={permLogData.permission}
                                    onChange={(e) => setPermLogData({ ...permLogData, permission: e.target.value })}
                                    placeholder="e.g., Roadwork"
                                    required
                                    className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">Username/s</label>
                                <input
                                    type="text"
                                    value={permLogData.usernames}
                                    onChange={(e) => setPermLogData({ ...permLogData, usernames: e.target.value })}
                                    placeholder="e.g., ciankellya, user123"
                                    required
                                    className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">Time</label>
                                <input
                                    type="text"
                                    value={permLogData.time}
                                    onChange={(e) => setPermLogData({ ...permLogData, time: e.target.value })}
                                    placeholder="e.g., Permanent or 30m"
                                    required
                                    className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            {permLogMessage && (
                                <p className={`text-sm ${permLogMessage.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                                    {permLogMessage.text}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={permLogLoading || !permLogData.permission || !permLogData.usernames || !permLogData.time}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50"
                            >
                                {permLogLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Log Permission
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* LOA Request Modal */}
            {loaOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#1a1a1a] rounded-t-2xl border-t border-l border-r border-[#333] overflow-hidden animate-in slide-in-from-bottom">
                        <div className="p-6 border-b border-[#222] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                    <Calendar className="h-5 w-5 text-orange-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">Request LOA</h3>
                                    <p className="text-xs text-zinc-500">Your quota will be paused</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setLoaOpen(false)}
                                aria-label="Close LOA Request"
                                className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleLoaSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">Start</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        required
                                        className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">End</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        required
                                        min={startDate}
                                        className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">Reason</label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    required
                                    rows={3}
                                    placeholder="Why you need time off..."
                                    className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 resize-none"
                                />
                            </div>

                            {loaMessage && (
                                <p className={`text-sm ${loaMessage.includes("submitted") ? "text-emerald-400" : "text-red-400"}`}>
                                    {loaMessage}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={submitting || !startDate || !endDate || !reason.trim()}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors disabled:opacity-50"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Submit Request
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Run Command Modal */}
            {commandOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#1a1a1a] rounded-t-2xl border-t border-l border-r border-[#333] overflow-hidden shadow-2xl animate-in slide-in-from-bottom">
                        <div className="p-6 border-b border-[#222] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                    <Terminal className="h-5 w-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">Run Command</h3>
                                    <p className="text-xs text-zinc-500">Execute on server</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setCommandOpen(false); setCommandMessage(null); setCommandInput("") }}
                                aria-label="Close Run Command"
                                className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCommandSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">Command</label>
                                <input
                                    type="text"
                                    value={commandInput}
                                    onChange={(e) => setCommandInput(e.target.value)}
                                    placeholder=":h [message] or any command..."
                                    autoFocus
                                    className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            {commandMessage && (
                                <p className={`text-sm ${commandMessage.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                                    {commandMessage.text}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={commandLoading || !commandInput.trim()}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50"
                            >
                                {commandLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Execute
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Staff Request Modal */}
            {staffRequestOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#1a1a1a] rounded-t-2xl border-t border-l border-r border-[#333] shadow-2xl overflow-hidden animate-in slide-in-from-bottom">
                        <div className="p-6 border-b border-[#222] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                                    <Bell className="h-5 w-5 text-red-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">Staff Request</h3>
                                    <p className="text-xs text-zinc-500">Alert all available staff</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setStaffRequestOpen(false)}
                                aria-label="Close Staff Request"
                                className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleStaffRequestSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                                    Reason
                                </label>
                                <textarea
                                    value={staffRequestReason}
                                    onChange={(e) => setStaffRequestReason(e.target.value)}
                                    placeholder="Why you need assistance..."
                                    className="w-full bg-[#222] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 min-h-[100px] resize-none"
                                    required
                                    autoFocus
                                />
                            </div>

                            {staffRequestMessage && (
                                <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${staffRequestMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                    {staffRequestMessage.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                    {staffRequestMessage.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={staffRequestLoading || !staffRequestReason.trim()}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold transition-all shadow-lg shadow-red-500/20"
                            >
                                {staffRequestLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-4 w-4" /> Send Request</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Calls Modal */}
            {callsOpen && (
                <CallsModal serverId={serverId} onClose={() => setCallsOpen(false)} />
            )}

            {/* Map Modal */}
            {mapOpen && (
                <MapModal serverId={serverId} onClose={() => setMapOpen(false)} />
            )}
        </>
    )
}
