"use client"

import { useState, useEffect } from "react"
import { ActivitySquare, ShieldAlert, Key, Search, Calendar, Globe, AlertTriangle, ShieldCheck, User, Monitor, LayoutDashboard, Database } from "lucide-react"

export function AuditLogClient({ serverId }: { serverId: string }) {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [eventFilter, setEventFilter] = useState("")
    const [originFilter, setOriginFilter] = useState("")

    useEffect(() => {
        fetchLogs()
    }, [serverId, eventFilter, originFilter])

    const fetchLogs = async () => {
        setLoading(true)
        try {
            let url = `/api/admin/audit?serverId=${serverId}`
            if (eventFilter) url += `&event=${eventFilter}`
            if (originFilter) url += `&origin=${originFilter}`

            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                setLogs(data.logs || [])
            }
        } finally {
            setLoading(false)
        }
    }

    const getEventIcon = (event: string) => {
        if (event.includes("BLOCKED") || event.includes("BANNED")) return <ShieldAlert className="h-4 w-4 text-red-400" />
        if (event.includes("API")) return <Key className="h-4 w-4 text-indigo-400" />
        if (event.includes("SUCCESS") || event.includes("AUTH")) return <ShieldCheck className="h-4 w-4 text-emerald-400" />
        if (event.includes("SETTINGS") || event.includes("UPDATED")) return <LayoutDashboard className="h-4 w-4 text-amber-400" />
        return <ActivitySquare className="h-4 w-4 text-zinc-400" />
    }

    if (loading) return <div className="text-zinc-400 p-6 flex items-center gap-2"><div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent animate-spin rounded-full" /> Loading Audit Log...</div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-white">Audit Log</h2>
                <p className="text-sm text-zinc-400">Review security events, API access, and system activity for this server.</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 p-4 bg-zinc-900/50 border border-white/5 rounded-xl">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-zinc-500 uppercase mb-2">Search Event</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Filter by event name..."
                            value={eventFilter}
                            onChange={(e) => setEventFilter(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                </div>
                <div className="w-[180px]">
                    <label className="block text-xs font-medium text-zinc-500 uppercase mb-2">Origin</label>
                    <select
                        value={originFilter}
                        onChange={(e) => setOriginFilter(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                        <option value="">All Origins</option>
                        <option value="DASHBOARD">Dashboard</option>
                        <option value="API">API</option>
                    </select>
                </div>
            </div>

            <div className="bg-zinc-900 border border-white/5 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-black/40 text-xs uppercase text-zinc-500 border-b border-white/5">
                            <tr>
                                <th className="px-6 py-4 font-medium">Event</th>
                                <th className="px-6 py-4 font-medium">User / Actor</th>
                                <th className="px-6 py-4 font-medium">Origin</th>
                                <th className="px-6 py-4 font-medium">Details</th>
                                <th className="px-6 py-4 font-medium">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                                        <ActivitySquare className="h-8 w-8 mx-auto mb-3 opacity-20" />
                                        No audit logs found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {getEventIcon(log.event)}
                                                <span className="font-medium text-zinc-200">
                                                    {log.event.replace(/_/g, " ")}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-zinc-300">
                                                {log.creatorId ? (
                                                    <>
                                                        <div className="h-6 w-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                                                            {log.creatorName.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <span className="text-xs">{log.creatorName}</span>
                                                    </>
                                                ) : (
                                                    <span className="text-zinc-600 italic text-xs">System</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                                                {log.origin === "DASHBOARD" ? (
                                                    <LayoutDashboard className="h-3 w-3 text-amber-400/50" />
                                                ) : (
                                                    <Database className="h-3 w-3 text-indigo-400/50" />
                                                )}
                                                {log.origin || "SYSTEM"}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-zinc-400 max-w-[300px] truncate">
                                            {log.details || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-zinc-500">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {new Date(log.createdAt).toLocaleString()}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
