"use client"

import { useState, useEffect } from "react"
import { ActivitySquare, ShieldAlert, Key, Search, Calendar, Globe, AlertTriangle, ShieldCheck } from "lucide-react"

export function AuditLogClient({ serverId }: { serverId: string }) {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchLogs()
    }, [serverId])

    const fetchLogs = async () => {
        try {
            const res = await fetch(`/api/admin/audit?serverId=${serverId}`)
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
        return <ActivitySquare className="h-4 w-4 text-zinc-400" />
    }

    if (loading) return <div className="text-zinc-400 p-6 flex items-center gap-2"><div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent animate-spin rounded-full" /> Loading Audit Log...</div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-white">Audit Log</h2>
                <p className="text-sm text-zinc-400">Review security events, API access, and system activity for this server.</p>
            </div>

            <div className="bg-zinc-900 border border-white/5 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-black/40 text-xs uppercase text-zinc-500 border-b border-white/5">
                            <tr>
                                <th className="px-6 py-4 font-medium">Event</th>
                                <th className="px-6 py-4 font-medium">Details</th>
                                <th className="px-6 py-4 font-medium">IP Address</th>
                                <th className="px-6 py-4 font-medium">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                                        <ActivitySquare className="h-8 w-8 mx-auto mb-3 opacity-20" />
                                        No audit logs found for this server.
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
                                        <td className="px-6 py-4 text-zinc-400 max-w-[300px] truncate">
                                            {log.details || "-"}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-xs">
                                                <Globe className="h-3 w-3" />
                                                {log.ip}
                                            </div>
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
