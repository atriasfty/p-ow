"use client"

import { useState } from "react"
import { Save, Loader2, Users, Trophy, Brain, Bell, Calendar, ShieldCheck } from "lucide-react"
import { ChannelCombobox } from "@/components/admin/channel-combobox"
import { RoleCombobox } from "@/components/admin/role-combobox"
import { Button } from "@/components/ui/button"

interface FormAutomationSettingsProps {
    serverId: string
    initialData: {
        recruitmentChannelId: string
        congratsChannelId: string
        loaChannelId: string
        onLoaRoleId: string
        applicationAiThreshold: number
        autoStaffRoleId: string
    }
}

export function FormAutomationSettings({ serverId, initialData }: FormAutomationSettingsProps) {
    const [recruitmentChannelId, setRecruitmentChannelId] = useState(initialData.recruitmentChannelId)
    const [congratsChannelId, setCongratsChannelId] = useState(initialData.congratsChannelId)
    const [loaChannelId, setLoaChannelId] = useState(initialData.loaChannelId)
    const [onLoaRoleId, setOnLoaRoleId] = useState(initialData.onLoaRoleId)
    const [applicationAiThreshold, setApplicationAiThreshold] = useState(initialData.applicationAiThreshold)
    const [autoStaffRoleId, setAutoStaffRoleId] = useState(initialData.autoStaffRoleId)

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
                    recruitmentChannelId: recruitmentChannelId || null,
                    congratsChannelId: congratsChannelId || null,
                    loaChannelId: loaChannelId || null,
                    onLoaRoleId: onLoaRoleId || null,
                    applicationAiThreshold,
                    autoStaffRoleId: autoStaffRoleId || null,
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
                {/* Recruitment Review Channel */}
                <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-emerald-400 uppercase tracking-wider">
                        <Bell className="h-4 w-4" />
                        Recruitment Review Channel
                    </label>
                    <ChannelCombobox
                        serverId={serverId}
                        value={recruitmentChannelId}
                        onChange={(val) => setRecruitmentChannelId(val || "")}
                        placeholder="Select channel..."
                    />
                    <p className="text-xs text-zinc-500">
                        Where new applications will be sent for administrative review.
                    </p>
                </div>

                {/* Congrats Channel */}
                <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-indigo-400 uppercase tracking-wider">
                        <Trophy className="h-4 w-4" />
                        Celebration Channel
                    </label>
                    <ChannelCombobox
                        serverId={serverId}
                        value={congratsChannelId}
                        onChange={(val) => setCongratsChannelId(val || "")}
                        placeholder="Select channel..."
                    />
                    <p className="text-xs text-zinc-500">
                        Where approved applications and staff milestones are announced.
                    </p>
                </div>

                {/* Auto-grant Role */}
                <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                        <Users className="h-4 w-4" />
                        Auto-grant Staff Role
                    </label>
                    <RoleCombobox
                        serverId={serverId}
                        value={autoStaffRoleId}
                        onChange={(val) => setAutoStaffRoleId(val || "")}
                        placeholder="Select role..."
                    />
                    <p className="text-xs text-zinc-500">
                        This Discord role will be automatically granted when an application is approved.
                    </p>
                </div>

                {/* AI Threshold */}
                <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                        <Brain className="h-4 w-4" />
                        AI Pre-screening (0-100)
                    </label>
                    <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-3 rounded-lg">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={applicationAiThreshold}
                            onChange={(e) => setApplicationAiThreshold(parseInt(e.target.value))}
                            className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <span className="text-lg font-bold text-emerald-400 w-10 text-center">
                            {applicationAiThreshold}
                        </span>
                    </div>
                    <p className="text-xs text-zinc-500">
                        Applications scoring below this will be flagged or automatically rejected by AI analysis.
                    </p>
                </div>

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
