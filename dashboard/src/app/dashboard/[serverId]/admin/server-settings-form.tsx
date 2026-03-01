
"use client"

import { useState } from "react"
import { Save, Loader2, RefreshCw, Bot, Users } from "lucide-react"
import { RoleCombobox } from "@/components/admin/role-combobox"
import { ChannelCombobox } from "@/components/admin/channel-combobox"
import Link from "next/link"

interface ServerSettingsFormProps {
    serverId: string
    currentName: string
    currentBanner: string | null
    currentOnDutyRoleId: string | null
    currentDiscordGuildId: string | null
    currentAutoSyncRoles: boolean
    currentSuspendedRoleId: string | null
    currentTerminatedRoleId: string | null
    currentStaffRoleId: string | null
    currentPermLogChannelId: string | null
    currentStaffRequestChannelId: string | null
    currentRaidAlertChannelId: string | null
    currentCommandLogChannelId: string | null
    currentCustomBotToken?: string | null
    currentCustomBotEnabled?: boolean
    subscriptionPlan?: string | null
    currentMaxUploadSize?: number | null
    currentStaffRequestRateLimit?: number | null
    isOwner?: boolean
    serverMembers?: any[]
}

export function ServerSettingsForm({
    serverId,
    currentName,
    currentBanner,
    currentOnDutyRoleId,
    currentDiscordGuildId,
    currentAutoSyncRoles,
    currentSuspendedRoleId,
    currentTerminatedRoleId,
    currentStaffRoleId,
    currentPermLogChannelId,
    currentStaffRequestChannelId,
    currentRaidAlertChannelId,
    currentCommandLogChannelId,
    currentCustomBotToken,
    currentCustomBotEnabled,
    subscriptionPlan,
    currentMaxUploadSize,
    currentStaffRequestRateLimit,
    isOwner,
    serverMembers
}: ServerSettingsFormProps) {
    const [name, setName] = useState(currentName)
    const [bannerUrl, setBannerUrl] = useState(currentBanner || "")
    const [onDutyRoleId, setOnDutyRoleId] = useState(currentOnDutyRoleId || "")
    const [discordGuildId, setDiscordGuildId] = useState(currentDiscordGuildId || "")
    const [autoSyncRoles, setAutoSyncRoles] = useState(currentAutoSyncRoles)
    const [suspendedRoleId, setSuspendedRoleId] = useState(currentSuspendedRoleId || "")
    const [terminatedRoleId, setTerminatedRoleId] = useState(currentTerminatedRoleId || "")
    const [staffRoleId, setStaffRoleId] = useState(currentStaffRoleId || "")
    const [permLogChannelId, setPermLogChannelId] = useState(currentPermLogChannelId || "")
    const [staffRequestChannelId, setStaffRequestChannelId] = useState(currentStaffRequestChannelId || "")
    const [raidAlertChannelId, setRaidAlertChannelId] = useState(currentRaidAlertChannelId || "")
    const [commandLogChannelId, setCommandLogChannelId] = useState(currentCommandLogChannelId || "")
    
    // Recruitment state
    const [recruitmentChannelId, setRecruitmentChannelId] = useState(currentRecruitmentChannelId || "")
    const [congratsChannelId, setCongratsChannelId] = useState(currentCongratsChannelId || "")
    const [applicationAiThreshold, setApplicationAiThreshold] = useState(currentApplicationAiThreshold || 70)
    const [autoStaffRoleId, setAutoStaffRoleId] = useState(currentAutoStaffRoleId || "")

    const [maxUploadSize, setMaxUploadSize] = useState(currentMaxUploadSize ? currentMaxUploadSize / 1024 / 1024 : 50)
    const [staffRequestRateLimit, setStaffRequestRateLimit] = useState(currentStaffRequestRateLimit ? currentStaffRequestRateLimit / 1000 / 60 : 5)

    // White label bot state
    const [customBotToken, setCustomBotToken] = useState(currentCustomBotToken || "")
    const [customBotEnabled, setCustomBotEnabled] = useState(currentCustomBotEnabled || false)

    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState("")

    // Danger Zone state
    const [newApiKey, setNewApiKey] = useState("")
    const [targetOwnerId, setTargetOwnerId] = useState("")
    const [deleteConfirm, setDeleteConfirm] = useState("")
    const [dangerLoading, setDangerLoading] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        setMessage("")

        try {
            const res = await fetch("/api/admin/server", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    serverId,
                    customName: name,
                    bannerUrl: bannerUrl || null,
                    onDutyRoleId: onDutyRoleId || null,
                    discordGuildId: discordGuildId || null,
                    autoSyncRoles,
                    suspendedRoleId: suspendedRoleId || null,
                    terminatedRoleId: terminatedRoleId || null,
                    staffRoleId: staffRoleId || null,
                    permLogChannelId: permLogChannelId || null,
                    staffRequestChannelId: staffRequestChannelId || null,
                    raidAlertChannelId: raidAlertChannelId || null,
                    commandLogChannelId: commandLogChannelId || null,
                    recruitmentChannelId: recruitmentChannelId || null,
                    congratsChannelId: congratsChannelId || null,
                    applicationAiThreshold,
                    autoStaffRoleId: autoStaffRoleId || null,
                    customBotToken: customBotToken || null,
                    customBotEnabled,
                    maxUploadSize: maxUploadSize * 1024 * 1024,
                    staffRequestRateLimit: staffRequestRateLimit * 1000 * 60
                })
            })

            if (res.ok) {
                setMessage("Settings saved!")
            } else {
                setMessage("Failed to save settings")
            }
        } catch (e: any) {
            setMessage("Error saving settings")
        } finally {
            setSaving(false)
            setTimeout(() => setMessage(""), 3000)
        }
    }

    const handleDangerAction = async (action: string, value?: string) => {
        if (!confirm(`Are you sure you want to perform this action?`)) return
        
        setDangerLoading(true)
        try {
            const res = await fetch("/api/admin/server/danger", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serverId, action, value })
            })

            const data = await res.json()
            if (res.ok) {
                alert(data.message || "Action successful")
                if (action === "TRANSFER_OWNERSHIP") window.location.href = "/dashboard"
            } else {
                alert(data.error || "Action failed")
            }
        } catch (e) {
            alert("An error occurred")
        } finally {
            setDangerLoading(false)
        }
    }

    const handleDeleteServer = async () => {
        if (deleteConfirm.trim() !== name.trim()) {
            alert("Please type the server name correctly to confirm deletion.")
            return
        }

        if (!confirm("FINAL WARNING: This will permanently delete all logs, punishments, and data for this server. This cannot be undone. Proceed?")) return

        setDangerLoading(true)
        try {
            const res = await fetch(`/api/admin/server/danger?serverId=${serverId}`, {
                method: "DELETE",
                headers: { 
                    "Content-Type": "application/json",
                    "x-csrf-check": "1" 
                }
            })

            if (res.ok) {
                window.location.href = "/dashboard"
            } else {
                const data = await res.json()
                alert(data.error || "Failed to delete server")
            }
        } catch (e) {
            alert("An error occurred")
        } finally {
            setDangerLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Server Name */}
            <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Display Name
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    placeholder="Server name..."
                />
                <p className="text-xs text-zinc-600 mt-1">This name will be displayed on the dashboard</p>
            </div>

            {/* Banner URL */}
            <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Banner Image URL
                </label>
                <div className="flex gap-2">
                    <input
                        type="url"
                        value={bannerUrl}
                        onChange={(e) => setBannerUrl(e.target.value)}
                        className="flex-1 bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                        placeholder="https://example.com/banner.png"
                    />
                </div>
                <p className="text-xs text-zinc-600 mt-1">Paste an image URL for the server banner. Recommended resolution: 1200x320</p>

                {/* Banner Preview */}
                {bannerUrl && (
                    <div className="mt-4">
                        <p className="text-xs text-zinc-500 mb-2">Preview:</p>
                        <div className="h-32 rounded-lg overflow-hidden bg-[#222] border border-[#333]">
                            <img
                                src={bannerUrl}
                                alt="Banner preview"
                                className="w-full h-full object-cover"
                                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                    e.currentTarget.src = ""
                                    e.currentTarget.alt = "Invalid image URL"
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Discord Integration Section */}
            <div className="border-t border-[#333] pt-6 mt-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-indigo-400" />
                    Discord Integration
                </h3>

                {/* Discord Guild ID */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                        Discord Server ID (Guild ID)
                    </label>
                    <input
                        type="text"
                        value={discordGuildId}
                        onChange={(e) => setDiscordGuildId(e.target.value)}
                        className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                        placeholder="123456789012345678"
                    />
                    <p className="text-xs text-zinc-600 mt-1">
                        Right-click your Discord server → Copy Server ID. Required for role sync.
                    </p>
                </div>

                {/* Perm Log Channel */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-blue-400 mb-2">
                        Permission Log Channel
                    </label>
                    <ChannelCombobox
                        serverId={serverId}
                        value={permLogChannelId}
                        onChange={(val) => setPermLogChannelId(val || "")}
                        placeholder="Select Permission Log channel..."
                    />
                    <p className="text-xs text-zinc-600 mt-1">
                        Channel where "Perm Logs" from the toolbox will be sent.
                    </p>
                </div>

                {/* Command Log Channel */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-emerald-400 mb-2">
                        Command Log Channel
                    </label>
                    <ChannelCombobox
                        serverId={serverId}
                        value={commandLogChannelId}
                        onChange={(val) => setCommandLogChannelId(val || "")}
                        placeholder="Select Command Log channel..."
                    />
                    <p className="text-xs text-zinc-600 mt-1">
                        Manual commands run via the toolbox will be logged here.
                    </p>
                </div>

                {/* Staff Request Channel */}
                <div className="mb-4 p-4 bg-amber-500/5 border border-amber-500/30 rounded-lg">
                    <label className="block text-sm font-medium text-amber-400 mb-2">
                        Staff Request Channel
                    </label>
                    <ChannelCombobox
                        serverId={serverId}
                        value={staffRequestChannelId}
                        onChange={(val) => setStaffRequestChannelId(val || "")}
                        placeholder="Select Staff Request channel..."
                    />
                    <p className="text-xs text-amber-400/70 mt-1">
                        Channel where staff request alerts will be sent (pings Staff Role).
                    </p>
                </div>

                {/* Raid Alert Channel */}
                <div className="mb-4 p-4 bg-red-500/5 border border-red-500/30 rounded-lg">
                    <label className="block text-sm font-medium text-red-400 mb-2">
                        Raid Alert Channel
                    </label>
                    <ChannelCombobox
                        serverId={serverId}
                        value={raidAlertChannelId}
                        onChange={(val) => setRaidAlertChannelId(val || "")}
                        placeholder="Select Raid Alert channel..."
                    />
                    <p className="text-xs text-red-400/70 mt-1">
                        Channel where raid notifications and mitigation prompts will be sent.
                    </p>
                </div>

                {/* On Duty Role ID */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                        On-Duty Role ID
                    </label>
                    <RoleCombobox
                        serverId={serverId}
                        value={onDutyRoleId}
                        onChange={(val) => setOnDutyRoleId(val || "")}
                        placeholder="Select On-Duty role..."
                    />
                    <p className="text-xs text-zinc-600 mt-1">
                        Staff will receive this Discord role when they start a shift.
                    </p>
                </div>

                {/* Staff Role ID */}
                <div className="mb-4 p-4 bg-emerald-500/5 border border-emerald-500/30 rounded-lg">
                    <label className="block text-sm font-medium text-emerald-400 mb-2">
                        Staff Role ID (Viewer Access)
                    </label>
                    <RoleCombobox
                        serverId={serverId}
                        value={staffRoleId}
                        onChange={(val) => setStaffRoleId(val || "")}
                        placeholder="Select Staff/Viewer role..."
                    />
                    <p className="text-xs text-emerald-400/70 mt-1">
                        Users with this Discord role get viewer access (can see logs/punishments but can't take actions).
                    </p>
                </div>

                {/* Auto Sync Toggle */}
                <div className="flex items-center justify-between p-4 bg-[#222] border border-[#333] rounded-lg">
                    <div>
                        <p className="text-white font-medium">Auto Role Sync</p>
                        <p className="text-xs text-zinc-500">Automatically sync panel roles to Discord every 10 seconds</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAutoSyncRoles(!autoSyncRoles)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoSyncRoles ? 'bg-indigo-500' : 'bg-zinc-700'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoSyncRoles ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>

                {/* Suspended Role ID */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-orange-400 mb-2">
                        Suspended Role ID
                    </label>
                    <RoleCombobox
                        serverId={serverId}
                        value={suspendedRoleId}
                        onChange={(val) => setSuspendedRoleId(val || "")}
                        placeholder="Select Suspended role..."
                    />
                    <p className="text-xs text-orange-400/70 mt-1">
                        Users with this Discord role will be blocked from the mod panel entirely.
                    </p>
                </div>

                {/* Terminated Role ID */}
                <div className="mb-4 p-4 bg-red-500/5 border border-red-500/30 rounded-lg">
                    <label className="block text-sm font-medium text-red-400 mb-2">
                        ⚠️ Terminated Role ID
                    </label>
                    <RoleCombobox
                        serverId={serverId}
                        value={terminatedRoleId}
                        onChange={(val) => setTerminatedRoleId(val || "")}
                        placeholder="Select Terminated role..."
                    />
                    <p className="text-xs text-red-400/70 mt-1">
                        <strong>DANGER:</strong> Users with this Discord role will have their account PERMANENTLY DELETED.
                    </p>
                </div>
            </div>

            {/* White Label Bot Section (POW Max Only) */}
            <div className="border-t border-[#333] pt-6 mt-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Bot className="h-5 w-5 text-purple-400" />
                    White Label Bot
                </h3>

                {subscriptionPlan !== "pow-max" ? (
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                        <p className="text-purple-400 text-sm mb-2">
                            <strong>Upgrade Required:</strong> The White Label Bot feature requires a POW Max subscription. Use your own Discord bot to send notifications and sync roles!
                        </p>
                        <Link href="/pricing" className="text-xs bg-purple-500 hover:bg-purple-600 text-white px-3 py-1.5 rounded inline-block transition-colors">
                            Upgrade to Max
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Auto Sync Toggle */}
                        <div className="flex items-center justify-between p-4 bg-[#222] border border-[#333] rounded-lg">
                            <div>
                                <p className="text-white font-medium">Enable Custom Bot</p>
                                <p className="text-xs text-zinc-500">Send logs, alerts, and sync roles using your own bot token instead of Project Overwatch.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCustomBotEnabled(!customBotEnabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${customBotEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${customBotEnabled ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>

                        {customBotEnabled && (
                            <div className="p-4 bg-[#222] border border-[#333] rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                                <label className="block text-sm font-medium text-zinc-400 mb-2">
                                    Bot Token
                                </label>
                                <input
                                    type="password"
                                    value={customBotToken}
                                    onChange={(e) => setCustomBotToken(e.target.value)}
                                    className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500"
                                    placeholder="MTAx..."
                                />
                                <p className="text-xs text-zinc-500 mt-2">
                                    Your bot must be invited to the Discord server and have the "Manage Roles", "View Channels", and "Send Messages" permissions.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors disabled:opacity-50"
                >
                    {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    Save Changes
                </button>
                {message && (
                    <span className={`text-sm ${message.includes("saved") ? "text-emerald-400" : "text-red-400"}`}>
                        {message}
                    </span>
                )}
            </div>

            {/* DANGER ZONE */}
            {isOwner && (
                <div className="border-t border-red-500/20 pt-8 mt-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <Bot className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Danger Zone</h2>
                            <p className="text-sm text-zinc-500">Critical actions that can't be undone</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Change API Key */}
                        <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-xl space-y-4">
                            <div>
                                <h4 className="font-bold text-white mb-1">Change PRC API Key</h4>
                                <p className="text-xs text-zinc-500">Update the server key used to link with PRC. This will affect all future logs and commands.</p>
                            </div>
                            <div className="flex gap-3">
                                <input
                                    type="password"
                                    value={newApiKey}
                                    onChange={(e) => setNewApiKey(e.target.value)}
                                    placeholder="Enter new API key..."
                                    className="flex-1 bg-[#111] border border-[#333] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500/50"
                                />
                                <button
                                    onClick={() => handleDangerAction("CHANGE_API_KEY", newApiKey)}
                                    disabled={dangerLoading || !newApiKey}
                                    className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-medium border border-red-500/20 transition-all disabled:opacity-50"
                                >
                                    Update Key
                                </button>
                            </div>
                        </div>

                        {/* Transfer Ownership */}
                        <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-xl space-y-4">
                            <div>
                                <h4 className="font-bold text-white mb-1">Transfer Ownership</h4>
                                <p className="text-xs text-zinc-500">Transfer this server to another member. You will lose owner access.</p>
                            </div>
                            <div className="flex gap-3">
                                <select
                                    value={targetOwnerId}
                                    onChange={(e) => setTargetOwnerId(e.target.value)}
                                    className="flex-1 bg-[#111] border border-[#333] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500/50"
                                >
                                    <option value="">Select new owner...</option>
                                    {serverMembers?.map(m => (
                                        <option key={m.userId} value={m.userId}>
                                            {m.robloxUsername || m.userId} {m.discordId ? `(${m.discordId})` : ""}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => handleDangerAction("TRANSFER_OWNERSHIP", targetOwnerId)}
                                    disabled={dangerLoading || !targetOwnerId}
                                    className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-medium border border-red-500/20 transition-all disabled:opacity-50"
                                >
                                    Transfer
                                </button>
                            </div>
                        </div>

                        {/* Delete Server */}
                        <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-xl space-y-4">
                            <div>
                                <h4 className="font-bold text-red-500 mb-1">Delete Server</h4>
                                <p className="text-xs text-zinc-500">Permanently remove this server and all its data from Project Overwatch.</p>
                            </div>
                            <div className="space-y-3">
                                <p className="text-[10px] text-zinc-400">To confirm, please type <strong>{name}</strong> below:</p>
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        value={deleteConfirm}
                                        onChange={(e) => setDeleteConfirm(e.target.value)}
                                        placeholder={name}
                                        className="flex-1 bg-[#111] border border-[#333] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                                    />
                                    <button
                                        onClick={handleDeleteServer}
                                        disabled={dangerLoading || deleteConfirm !== name}
                                        className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-lg shadow-red-900/20 transition-all disabled:opacity-50"
                                    >
                                        DELETE SERVER
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
