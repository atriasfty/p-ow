"use client"

import { useState } from "react"
import { Download, Loader2, FileSpreadsheet } from "lucide-react"
import { useDialog } from "@/components/providers/dialog-provider"

export function DataExportsPanel({ serverId, hasExportAccess }: { serverId: string, hasExportAccess: boolean }) {
    const [downloading, setDownloading] = useState<string | null>(null)
    const { showAlert } = useDialog()

    const handleExport = async (type: string) => {
        if (!hasExportAccess) {
            await showAlert("Upgrade Required", "This feature requires a POW Pro or POW Max subscription.", "warning")
            return
        }

        setDownloading(type)
        try {
            const res = await fetch(`/api/admin/exports?serverId=${serverId}&type=${type}`)
            if (!res.ok) {
                if (res.status === 403) await showAlert("Upgrade Required", "Subscription upgrade required to export data.", "warning")
                else await showAlert("Export Failed", "Failed to export data.", "error")
                return
            }

            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `pow_${type}_export.csv`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (e) {
            await showAlert("Export Error", "An error occurred while exporting.", "error")
        } finally {
            setDownloading(null)
        }
    }

    return (
        <div className="bg-[#1a1a1a] rounded-xl border border-[#222] overflow-hidden">
            <div className="p-6 border-b border-[#222]">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <FileSpreadsheet className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                        <h2 className="font-bold text-white">Data Exports</h2>
                        <p className="text-xs text-zinc-500">Download your server data as CSV. Excludes emails and PII.</p>
                    </div>
                </div>
            </div>

            <div className="p-6">
                {!hasExportAccess && (
                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400">
                        <strong>Pro Feature:</strong> Upgrade your server subscription to export your members, shifts, and roles to CSV files.
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 bg-[#222] border border-[#333] rounded-lg flex flex-col justify-between">
                        <div>
                            <h3 className="font-semibold text-white mb-1">Members List</h3>
                            <p className="text-xs text-zinc-500 mb-4">Export all registered staff members, their linked Roblox/Discord usernames, and their assigned panel roles.</p>
                        </div>
                        <button
                            onClick={() => handleExport('members')}
                            disabled={!hasExportAccess || downloading === 'members'}
                            className="flex items-center justify-center gap-2 w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors disabled:opacity-50"
                        >
                            {downloading === 'members' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Export CSV
                        </button>
                    </div>

                    <div className="p-4 bg-[#222] border border-[#333] rounded-lg flex flex-col justify-between">
                        <div>
                            <h3 className="font-semibold text-white mb-1">Shift History</h3>
                            <p className="text-xs text-zinc-500 mb-4">Export the last 500 recorded shifts including start/end times and total duration in seconds.</p>
                        </div>
                        <button
                            onClick={() => handleExport('shifts')}
                            disabled={!hasExportAccess || downloading === 'shifts'}
                            className="flex items-center justify-center gap-2 w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors disabled:opacity-50"
                        >
                            {downloading === 'shifts' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Export CSV
                        </button>
                    </div>

                    <div className="p-4 bg-[#222] border border-[#333] rounded-lg flex flex-col justify-between">
                        <div>
                            <h3 className="font-semibold text-white mb-1">Roles Configuration</h3>
                            <p className="text-xs text-zinc-500 mb-4">Export your panel roles list with their attached Discord Role IDs and permissions overview.</p>
                        </div>
                        <button
                            onClick={() => handleExport('roles')}
                            disabled={!hasExportAccess || downloading === 'roles'}
                            className="flex items-center justify-center gap-2 w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors disabled:opacity-50"
                        >
                            {downloading === 'roles' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Export CSV
                        </button>
                    </div>

                    <div className="p-4 bg-[#222] border border-[#333] rounded-lg flex flex-col justify-between">
                        <div>
                            <h3 className="font-semibold text-white mb-1">Punishment Logs</h3>
                            <p className="text-xs text-zinc-500 mb-4">Export the last 1,000 punishment records including user/mod usernames, type, reason, and status.</p>
                        </div>
                        <button
                            onClick={() => handleExport('punishments')}
                            disabled={!hasExportAccess || downloading === 'punishments'}
                            className="flex items-center justify-center gap-2 w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors disabled:opacity-50"
                        >
                            {downloading === 'punishments' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Export CSV
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
