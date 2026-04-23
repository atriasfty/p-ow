
"use client"

import React, { useState } from "react"
import { Command, Zap, Calendar, X, Send, Loader2, Check, Terminal, ClipboardList, Bell, Phone, Map } from "lucide-react"
import { CallsModal } from "./calls-modal"
import { MapModal } from "./map-modal"
import { usePermissions } from "@/components/auth/role-sync-wrapper"

interface ToolboxProps {
    serverId: string
    isOnLoa?: boolean
    featureLoa?: boolean
    featureStaffReq?: boolean
    featurePermLog?: boolean
}

export function Toolbox({
    serverId,
    isOnLoa,
    featureLoa = true,
    featureStaffReq = true,
    featurePermLog = true
}: ToolboxProps) {
    const [loaOpen, setLoaOpen] = useState(false)
    const [commandOpen, setCommandOpen] = useState(false)
    const [permLogOpen, setPermLogOpen] = useState(false)
    const [staffRequestOpen, setStaffRequestOpen] = useState(false)
    const [callsOpen, setCallsOpen] = useState(false)
    const [mapOpen, setMapOpen] = useState(false)

    // LOA form state
    // ...
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
        // ... (existing submit logic remains same)
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
        // ... (existing command logic remains same)
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

    return (
        <>
            {/* Toolbox Bar */}
            <div className="flex items-center gap-2 p-2 bg-[#1a1a1a] border border-[#222] rounded-xl overflow-x-auto no-scrollbar flex-shrink-0">
                <div className="flex items-center gap-2 px-3 py-1 text-xs text-zinc-500">
                    <Command className="h-3 w-3" />
                    <span>Toolbox</span>
                </div>

                <div className="h-4 w-px bg-[#333]" />

                {/* Perm Log Button */}
                {permissions.canUseToolbox && featurePermLog && (
                    <button
                        onClick={() => setPermLogOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 hover:text-blue-300 transition-all flex-shrink-0"
                    >
                        <ClipboardList className="h-4 w-4" />
                        <span className="text-sm font-medium">Perm Log</span>
                    </button>
                )}

                {/* LOA Request Button */}
                {permissions.canRequestLoa && featureLoa && (
                    isOnLoa ? (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-700/30 border border-zinc-600/20 text-zinc-500 flex-shrink-0">
                            <Check className="h-4 w-4" />
                            <span className="text-sm font-medium">On LOA</span>
                        </div>
                    ) : (
                        <button
                            onClick={() => setLoaOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:border-orange-500/40 text-orange-400 hover:text-orange-300 transition-all flex-shrink-0"
                        >
                            <Calendar className="h-4 w-4" />
                            <span className="text-sm font-medium">Request LOA</span>
                        </button>
                    )
                )}

                {/* Run Command Button */}
                {permissions.canUseToolbox && (
                    <button
                        onClick={() => setCommandOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-all flex-shrink-0"
                    >
                        <Terminal className="h-4 w-4" />
                        <span className="text-sm font-medium">Run Command</span>
                    </button>
                )}

                {/* Staff Request Button */}
                {permissions.canUseToolbox && featureStaffReq && (
                    <button
                        onClick={() => setStaffRequestOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 transition-all flex-shrink-0"
                    >
                        <Bell className="h-4 w-4" />
                        <span className="text-sm font-medium">Staff Request</span>
                    </button>
                )}

                {/* Calls Button (PRC v2) */}
                <button
                    onClick={() => setCallsOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400 hover:text-indigo-300 transition-all flex-shrink-0"
                >
                    <Phone className="h-4 w-4" />
                    <span className="text-sm font-medium">Calls</span>
                </button>

                {/* Map Button (PRC v2) */}
                <button
                    onClick={() => setMapOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400 hover:text-indigo-300 transition-all flex-shrink-0"
                >
                    <Map className="h-4 w-4" />
                    <span className="text-sm font-medium">Map</span>
                </button>
            </div>

            {/* Perm Log Modal */}
            {permLogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-[#333] overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-[#222] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                    <ClipboardList className="h-5 w-5 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">Log Permission</h3>
                                    <p className="text-xs text-zinc-500">Record a permission usage in Discord</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setPermLogOpen(false)
                                    setPermLogMessage(null)
                                }}
                                aria-label="Close Permission Log"
                                className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handlePermLogSubmit} className="p-6 space-y-4">
                            <div>
                                <label htmlFor="permission" className="block text-sm font-medium text-zinc-400 mb-2">Permission</label>
                                <input
                                    id="permission"
                                    type="text"
                                    value={permLogData.permission}
                                    onChange={(e) => setPermLogData({ ...permLogData, permission: e.target.value })}
                                    placeholder="e.g., Roadwork"
                                    required
                                    className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="usernames" className="block text-sm font-medium text-zinc-400 mb-2">Username/s</label>
                                <input
                                    id="usernames"
                                    type="text"
                                    value={permLogData.usernames}
                                    onChange={(e) => setPermLogData({ ...permLogData, usernames: e.target.value })}
                                    placeholder="e.g., ciankellya, user123"
                                    required
                                    className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="time" className="block text-sm font-medium text-zinc-400 mb-2">Time</label>
                                <input
                                    id="time"
                                    type="text"
                                    value={permLogData.time}
                                    onChange={(e) => setPermLogData({ ...permLogData, time: e.target.value })}
                                    placeholder="e.g., Permanent or 30m"
                                    required
                                    className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                                {permLogLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                                Log Permission
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* LOA Request Modal */}
            {loaOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-[#333] overflow-hidden">
                        <div className="p-6 border-b border-[#222]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                        <Calendar className="h-5 w-5 text-orange-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">Request Leave of Absence</h3>
                                        <p className="text-xs text-zinc-500">Your quota will be paused during LOA</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setLoaOpen(false)}
                                    aria-label="Close LOA Request"
                                    className="p-2 hover:bg-white/10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                                >
                                    <X className="h-4 w-4 text-zinc-400" />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleLoaSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="startDate" className="block text-sm font-medium text-zinc-400 mb-2">Start Date</label>
                                    <input
                                        id="startDate"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        required
                                        className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="endDate" className="block text-sm font-medium text-zinc-400 mb-2">End Date</label>
                                    <input
                                        id="endDate"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        required
                                        min={startDate}
                                        className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="reason" className="block text-sm font-medium text-zinc-400 mb-2">Reason</label>
                                <textarea
                                    id="reason"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    required
                                    rows={3}
                                    placeholder="Please explain why you need time off..."
                                    className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 resize-none"
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
                                {submitting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                                Submit Request
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Run Command Modal */}
            {commandOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-[#333] overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-[#222] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                    <Terminal className="h-5 w-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">Run Command</h3>
                                    <p className="text-xs text-zinc-500">Execute a command on the server</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setCommandOpen(false)
                                    setCommandMessage(null)
                                    setCommandInput("")
                                }}
                                aria-label="Close Run Command"
                                className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCommandSubmit} className="p-6 space-y-4">
                            <div>
                                <label htmlFor="commandInput" className="block text-sm font-medium text-zinc-400 mb-2">Command</label>
                                <input
                                    id="commandInput"
                                    type="text"
                                    value={commandInput}
                                    onChange={(e) => setCommandInput(e.target.value)}
                                    placeholder=":h [message] or any server command..."
                                    autoFocus
                                    className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
                                {commandLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                                Execute
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Staff Request Modal */}
            {staffRequestOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-[#333] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-[#222] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                                    <Bell className="h-5 w-5 text-red-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">Staff Request</h3>
                                    <p className="text-xs text-zinc-500 mt-0.5">Alert all available staff</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setStaffRequestOpen(false)}
                                aria-label="Close Staff Request"
                                className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleStaffRequestSubmit} className="p-6 space-y-4">
                            <div>
                                <label htmlFor="staffRequestReason" className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                                    Reason for request
                                </label>
                                <textarea
                                    id="staffRequestReason"
                                    value={staffRequestReason}
                                    onChange={(e) => setStaffRequestReason(e.target.value)}
                                    placeholder="Briefly describe why you need staff assistance..."
                                    className="w-full bg-[#222] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors min-h-[100px] resize-none"
                                    required
                                    autoFocus
                                />
                                <p className="text-[10px] text-zinc-600 mt-2 italic">
                                    Note: Online staff will be PM'd in-game (reason excluded due to censorship).
                                    The full reason will be sent to the Discord staff request channel.
                                </p>
                            </div>

                            {staffRequestMessage && (
                                <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${staffRequestMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    }`}>
                                    {staffRequestMessage.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                    {staffRequestMessage.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={staffRequestLoading || !staffRequestReason.trim()}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-red-500 text-white font-bold transition-all shadow-lg shadow-red-500/20"
                            >
                                {staffRequestLoading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" />
                                        Send Request
                                    </>
                                )}
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
