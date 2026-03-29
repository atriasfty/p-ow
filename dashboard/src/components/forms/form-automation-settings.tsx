"use client"

import { useState } from "react"
import { Save, Loader2, Users, Trophy, Bell, Calendar, ShieldCheck } from "lucide-react"
import { ChannelCombobox } from "@/components/admin/channel-combobox"
import { RoleCombobox } from "@/components/admin/role-combobox"
import { Button } from "@/components/ui/button"

interface FormAutomationSettingsProps {
    serverId: string
    initialData: {
        loaChannelId: string
        onLoaRoleId: string
    }
}

export function FormAutomationSettings({ serverId, initialData }: FormAutomationSettingsProps) {
    const [loaChannelId, setLoaChannelId] = useState(initialData.loaChannelId)
    const [onLoaRoleId, setOnLoaRoleId] = useState(initialData.onLoaRoleId)

    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState("")

    const handleSave = async () => {
        setSaving(true)
        setMessage("")

        try {
            const res = await fetch("/api/admin/server", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    serverId,
                    loaChannelId: loaChannelId || null,
                    onLoaRoleId: onLoaRoleId || null,
                })
            })

            if (res.ok) {
                setMessage("Settings saved successfully!")
            } else {
                setMessage("Failed to save settings")
            }
        } catch (e) {
            setMessage("Error saving settings")
        } finally {
            setSaving(false)
            setTimeout(() => setMessage(""), 3000)
        }
    }

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* LOA Request Channel */}
                <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-orange-400 uppercase tracking-wider">
                        <Calendar className="h-4 w-4" />
                        LOA Request Channel
                    </label>
                    <ChannelCombobox
                        serverId={serverId}
                        value={loaChannelId}
                        onChange={(val) => setLoaChannelId(val || "")}
                        placeholder="Select channel..."
                    />
                    <p className="text-xs text-zinc-500">
                        Where new Leave of Absence requests will be sent for approval.
                    </p>
                </div>

                {/* On-LOA Role */}
                <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                        <ShieldCheck className="h-4 w-4" />
                        On-LOA Discord Role
                    </label>
                    <RoleCombobox
                        serverId={serverId}
                        value={onLoaRoleId}
                        onChange={(val) => setOnLoaRoleId(val || "")}
                        placeholder="Select role..."
                    />
                    <p className="text-xs text-zinc-500">
                        This role is automatically applied while a user is on an active, approved LOA.
                    </p>
                </div>
            </div>

            <div className="pt-6 border-t border-[#333] flex items-center gap-4">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 h-12 rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/20"
                >
                    {saving ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                        <Save className="h-5 w-5 mr-2" />
                    )}
                    Save Automation Settings
                </Button>
                {message && (
                    <span className={`text-sm font-medium animate-in fade-in duration-300 ${
                        message.includes("success") ? "text-emerald-400" : "text-red-400"
                    }`}>
                        {message}
                    </span>
                )}
            </div>
        </div>
    )
}
