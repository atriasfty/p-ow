
"use client"

import { useActionState, useState, useEffect } from "react"
import { submitPunishment } from "./actions"
import { AlertTriangle, Ban, Shield, CheckCircle, XCircle, Siren } from "lucide-react"
import { motion } from "framer-motion"

import { usePermissions } from "@/components/auth/role-sync-wrapper"

export function PunishmentForm({ serverId, userId, username }: { serverId: string, userId: string, username: string }) {
    const { permissions } = usePermissions()
    const [type, setType] = useState<string | null>(null)
    const [state, formAction, isPending] = useActionState(submitPunishment, null)

    const tabs = [
        { id: "Warn", icon: Shield, color: "text-blue-500", bg: "bg-blue-500", border: "border-blue-500/50", allowed: permissions.canIssueWarnings },
        { id: "Kick", icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500", border: "border-amber-500/50", allowed: permissions.canKick },
        { id: "Ban", icon: Ban, color: "text-red-500", bg: "bg-red-500", border: "border-red-500/50", allowed: permissions.canBan },
        { id: "Ban Bolo", icon: Siren, color: "text-yellow-500", bg: "bg-yellow-500", border: "border-yellow-500/50", allowed: permissions.canBanBolo }
    ].filter(t => t.allowed)

    // Set default type on mount or when tabs change
    useEffect(() => {
        if (!type && tabs.length > 0) {
            setType(tabs[0].id)
        }
    }, [tabs.length]) // eslint-disable-line react-hooks/exhaustive-deps

    if (tabs.length === 0) {
        return <div className="p-4 text-center text-zinc-500 text-sm">You do not have permission to issue any punishments.</div>
    }

    return (
        <form action={formAction} className="space-y-4">
            <input type="hidden" name="serverId" value={serverId} />
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="username" value={username} />
            <input type="hidden" name="type" value={type || ""} />

            {/* Type Selector with Sliding Animation */}
            <div className="grid grid-cols-4 gap-2 bg-[#111] p-1 rounded-xl border border-[#333]">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setType(t.id)}
                        className={`relative flex flex-col items-center justify-center py-3 rounded-lg transition-colors z-10 ${type === t.id ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                            }`}
                    >
                        {type === t.id && (
                            <motion.div
                                layoutId="activeTab"
                                className={`absolute inset-0 rounded-lg ${t.bg} border ${t.border}`}
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        {/* We separate the icon/text so z-index works atop the motion div */}
                        <div className="relative flex flex-col items-center">
                            <t.icon className={`h-5 w-5 mb-1 ${type === t.id ? "text-white" : t.color + " opacity-50"}`} />
                            <span className={`text-[10px] font-bold uppercase ${type === t.id ? "text-white" : ""}`}>{t.id}</span>
                        </div>
                    </button>
                ))}
            </div>

            {/* Reason Input */}
            <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2 ml-1">Reason</label>
                <textarea
                    name="reason"
                    required
                    placeholder={`Reason for ${type}...`}
                    className="w-full rounded-xl bg-[#222] border border-[#333] p-4 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none h-32"
                />
            </div>

            {/* Submit */}
            <button
                type="submit"
                disabled={isPending}
                className={`w-full rounded-xl font-bold py-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${isPending ? "bg-zinc-800 text-zinc-500" : "bg-white text-black hover:bg-zinc-200"
                    }`}
            >
                {isPending ? "Processing..." : `Issue ${type}`}
            </button>

            {/* Feedback */}
            {state?.message && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-lg flex items-center gap-2 text-sm font-medium ${state.success ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                        }`}>
                    {state.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {state.message}
                </motion.div>
            )}
        </form>
    )
}
