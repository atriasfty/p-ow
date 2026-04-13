"use client"

import { useState } from "react"
import { Search, Loader2, History, RotateCcw, Clock } from "lucide-react"
import { usePostHog } from "posthog-js/react"
import { useDialog } from "@/components/providers/dialog-provider"

interface RaidMitigationClientProps {
    serverId: string
}

export function RaidMitigationClient({ serverId }: RaidMitigationClientProps) {
    const posthog = usePostHog()
    const { showConfirm } = useDialog()
    const [query, setQuery] = useState("")
    const [searching, setSearching] = useState(false)
    const [targetUser, setTargetUser] = useState<{ id: string; name: string } | null>(null)
    const [logs, setLogs] = useState<any[]>([])
    const [loadingLogs, setLoadingLogs] = useState(false)
    const [analyzing, setAnalyzing] = useState(false)
    const [rollbackTime, setRollbackTime] = useState("")
    const [rollingBack, setRollingBack] = useState(false)
    const [message, setMessage] = useState("")

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!query.trim()) return

        setSearching(true)
        setTargetUser(null)
        setLogs([])
        setMessage("")

        try {
            // 1. Resolve User
            const userRes = await fetch(`/api/roblox/user?username=${encodeURIComponent(query)}`)
            const userData = await userRes.json()

            if (!userRes.ok || !userData.id) {
                setMessage("User not found")
                setSearching(false)
                return
            }

            setTargetUser({ id: String(userData.id), name: userData.name })

            // 2. Fetch Logs for this user (as actor)
            setLoadingLogs(true)
            const logsRes = await fetch(`/api/admin/logs?serverId=${serverId}&playerId=${userData.id}&limit=100&type=command`)
            const logsData = await logsRes.json()

            if (logsRes.ok) {
                setLogs(logsData.logs || [])
                analyzeRollback(logsData.logs || [])
            } else {
                setMessage("Failed to fetch logs")
            }
        } catch (e) {
            setMessage("Error occurred during search")
        } finally {
            setSearching(false)
            setLoadingLogs(false)
        }
    }

    const analyzeRollback = async (logsToAnalyze: any[]) => {
        setAnalyzing(true)
        try {
            const reversableCommands = [":ban", ":unban", ":unadmin", ":unmod"]
            const count = logsToAnalyze.filter(l =>
                l.command && reversableCommands.some(cmd => l.command.toLowerCase().startsWith(cmd))
            ).length

            if (count > 0) {
                setMessage(`Found ${count} potentially reversable actions in recent history.`)
            } else {
                setMessage("No reversable actions found in recent history.")
            }
        } finally {
            setAnalyzing(false)
        }
    }

    const handleRollback = async () => {
        if (!targetUser) return

        let confirmMsg = `Are you sure you want to rollback actions for ${targetUser.name}?`
        if (rollbackTime) {
            confirmMsg += ` This will reverse actions taken after ${new Date(rollbackTime).toLocaleString()}.`
        } else {
            confirmMsg += ` This will reverse actions from the last 24 hours.`
        }

        const confirmed = await showConfirm("Confirm Rollback", confirmMsg, "Rollback", "destructive")
        if (!confirmed) return

        setRollingBack(true)
        try {
            const res = await fetch(`/api/admin/rollback`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-csrf-check": "1"
                },
                body: JSON.stringify({
                    serverId,
                    targetUserId: targetUser.id,
                    timestamp: rollbackTime ? new Date(rollbackTime).toISOString() : undefined
                })
            })

            const data = await res.json()
            if (res.ok) {
                setMessage(`Rollback queued: ${data.reversalsQueued} actions reversed.`)
                posthog?.capture("raid_rollback_executed", { serverId, targetUserId: targetUser.id, timestamp: rollbackTime })
            } else {
                setMessage(`Rollback failed: ${data.error}`)
            }
        } catch (e) {
            setMessage("Error executing rollback")
        } finally {
            setRollingBack(false)
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Search Panel */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-[#1a1a1a] border border-[#222] rounded-xl p-6">
                    <h3 className="text-white font-semibold mb-4">Identify Raider</h3>
                    <form onSubmit={handleSearch} className="space-y-4">
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Roblox Username or ID</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search user..."
                                    className="w-full bg-[#222] border border-[#333] rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                                />
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={searching || !query}
                            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search & Analyze"}
                        </button>
                    </form>

                    {targetUser && (
                        <div className="mt-6 pt-6 border-t border-[#222]">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-[#222] rounded-full overflow-hidden">
                                    <img
                                        src={`https://www.roblox.com/headshot-thumbnail/image?userId=${targetUser.id}&width=150&height=150&format=png`}
                                        alt={targetUser.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <p className="text-white text-sm font-medium">{targetUser.name}</p>
                                    <p className="text-xs text-zinc-500">ID: {targetUser.id}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {targetUser && (
                    <div className="bg-[#1a1a1a] border border-[#222] rounded-xl p-6 border-l-4 border-l-red-500">
                        <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                            <RotateCcw className="h-4 w-4 text-red-400" />
                            Mitigation Actions
                        </h3>
                        <p className="text-zinc-400 text-sm mb-4">
                            Rollback will reverse only: :ban, :unban, :unadmin, :unmod.
                        </p>

                        <div className="mb-4">
                            <label className="block text-xs text-zinc-500 mb-1">Rollback actions after:</label>
                            <div className="relative">
                                <input
                                    type="datetime-local"
                                    value={rollbackTime}
                                    onChange={(e) => setRollbackTime(e.target.value)}
                                    className="w-full bg-[#222] border border-[#333] rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors [color-scheme:dark]"
                                />
                                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                            </div>
                            <p className="text-[10px] text-zinc-600 mt-1">Leave empty to rollback last 24h</p>
                        </div>

                        <button
                            onClick={handleRollback}
                            disabled={rollingBack}
                            className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 text-sm font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {rollingBack ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rollback Actions"}
                        </button>
                        {message && (
                            <p className={`text-xs mt-3 text-center ${message.includes("failed") || message.includes("Error") ? "text-red-400" : "text-emerald-400"}`}>
                                {message}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Logs Feed */}
            <div className="lg:col-span-2 bg-[#1a1a1a] border border-[#222] rounded-xl overflow-hidden flex flex-col h-[600px]">
                <div className="p-4 border-b border-[#222] flex items-center justify-between">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                        <History className="h-4 w-4 text-zinc-400" />
                        Recent Activity
                    </h3>
                    <span className="text-xs text-zinc-500">
                        {loadingLogs ? "Loading..." : `${logs.length} events found`}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loadingLogs ? (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <p className="text-sm">Fetching logs...</p>
                        </div>
                    ) : logs.length > 0 ? (
                        logs.map((log) => (
                            <div key={log.id} className="bg-[#222] p-3 rounded-lg border border-[#333] flex items-start gap-3">
                                <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${[":ban", ":unban", ":unmod", ":unadmin"].some(cmd => log.command?.toLowerCase().startsWith(cmd))
                                        ? "bg-red-500"
                                        : "bg-zinc-600"
                                    }`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-zinc-300 text-sm font-mono break-all">{log.command}</p>
                                    <p className="text-zinc-600 text-xs mt-1">
                                        {new Date(log.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                            <p className="text-sm">No recent activity found for this user.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}