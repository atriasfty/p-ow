"use client"

import { useState } from "react"
import { Save, Loader2, RefreshCw, Bot, RotateCcw, LayoutDashboard, Zap, MessageSquare, Users, BarChart3, ShieldCheck, AlertTriangle, Globe } from "lucide-react"
import { RoleCombobox } from "@/components/admin/role-combobox"
import { ChannelCombobox } from "@/components/admin/channel-combobox"
import { useDialog } from "@/components/providers/dialog-provider"
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
    currentMilestoneChannelId?: string | null
    currentLoaChannelId?: string | null
    currentOnLoaRoleId?: string | null
    currentCustomBotToken?: string | null
    currentCustomBotEnabled?: boolean
    subscriptionPlan?: string | null
    currentMaxUploadSize?: number | null
    currentStaffRequestRateLimit?: number | null
    featureLoa?: boolean
    featureStaffReq?: boolean
    featurePermLog?: boolean
    currentWebhookUrl?: string | null
    currentWebhookEvents?: string | null
    isOwner?: boolean
    serverMembers?: any[]
    botMissingPermissions?: boolean
    deletionScheduledAt?: Date | string | null
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
    currentMilestoneChannelId,
    currentLoaChannelId,
    currentOnLoaRoleId,
    currentCustomBotToken,
    currentCustomBotEnabled,
    subscriptionPlan,
    currentMaxUploadSize,
    currentStaffRequestRateLimit,
    featureLoa = true,
    featureStaffReq = true,
    featurePermLog = true,
    currentWebhookUrl,
    currentWebhookEvents,
    isOwner,
    serverMembers,
    botMissingPermissions: initialBotMissingPermissions = false,
    deletionScheduledAt: initialDeletionScheduledAt = null
}: ServerSettingsFormProps) {
    const [isSyncing, setIsSyncing] = useState(false)
    const [botMissingPermissions, setBotMissingPermissions] = useState(initialBotMissingPermissions)
    const [deletionScheduledAt, setDeletionScheduledAt] = useState(initialDeletionScheduledAt)

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
    const [milestoneChannelId, setMilestoneChannelId] = useState(currentMilestoneChannelId || "")
    const [loaChannelId, setLoaChannelId] = useState(currentLoaChannelId || "")
    const [onLoaRoleId, setOnLoaRoleId] = useState(currentOnLoaRoleId || "")

    // Advanced Config
    const [maxUploadSize, setMaxUploadSize] = useState(currentMaxUploadSize ? currentMaxUploadSize / 1024 / 1024 : 50)
    const [staffRequestRateLimit, setStaffRequestRateLimit] = useState(currentStaffRequestRateLimit ? currentStaffRequestRateLimit / 1000 / 60 : 5)

    // White label bot state
    const [customBotToken, setCustomBotToken] = useState(currentCustomBotToken || "")
    const [customBotEnabled, setCustomBotEnabled] = useState(currentCustomBotEnabled || false)

    // Feature Toggles state
    const [isFeatureLoa, setIsFeatureLoa] = useState(featureLoa)
    const [isFeatureStaffReq, setIsFeatureStaffReq] = useState(featureStaffReq)
    const [isFeaturePermLog, setIsFeaturePermLog] = useState(featurePermLog)

    // Webhook state
    const [webhookUrl, setWebhookUrl] = useState(currentWebhookUrl || "")
    const [webhookEvents, setWebhookEvents] = useState<string[]>(() => {
        try {
            return currentWebhookEvents ? JSON.parse(currentWebhookEvents) : []
        } catch (e) {
            return []
        }
    })

    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState("")
    const [activeCategory, setActiveCategory] = useState("general")

    // Danger Zone state
    const [newApiKey, setNewApiKey] = useState("")
    const [targetOwnerId, setTargetOwnerId] = useState("")
    const [deleteConfirm, setDeleteConfirm] = useState("")
    const [dangerLoading, setDangerLoading] = useState(false)
    const { showAlert, showConfirm } = useDialog()

    const handleSyncCommands = async () => {
        setIsSyncing(true)
        try {
            const res = await fetch(`/api/admin/server/${serverId}/sync-commands`, {
                method: "POST"
            })
            const data = await res.json()
            if (data.success) {
                await showAlert("Sync Requested", "The bot has been notified to re-sync commands. This may take a moment to reflect.", "success")
            } else {
                throw new Error(data.error || "Failed to request sync")
            }
        } catch (error: any) {
            await showAlert("Sync Failed", error.message || "An unknown error occurred", "error")
        } finally {
            setIsSyncing(false)
        }
    }

    const isDirty =
        name !== currentName ||
        bannerUrl !== (currentBanner || "") ||
        onDutyRoleId !== (currentOnDutyRoleId || "") ||
        discordGuildId !== (currentDiscordGuildId || "") ||
        autoSyncRoles !== currentAutoSyncRoles ||
        suspendedRoleId !== (currentSuspendedRoleId || "") ||
        terminatedRoleId !== (currentTerminatedRoleId || "") ||
        staffRoleId !== (currentStaffRoleId || "") ||
        permLogChannelId !== (currentPermLogChannelId || "") ||
        staffRequestChannelId !== (currentStaffRequestChannelId || "") ||
        raidAlertChannelId !== (currentRaidAlertChannelId || "") ||
        commandLogChannelId !== (currentCommandLogChannelId || "") ||
        milestoneChannelId !== (currentMilestoneChannelId || "") ||
        loaChannelId !== (currentLoaChannelId || "") ||
        onLoaRoleId !== (currentOnLoaRoleId || "") ||
        maxUploadSize !== (currentMaxUploadSize ? currentMaxUploadSize / 1024 / 1024 : 50) ||
        staffRequestRateLimit !== (currentStaffRequestRateLimit ? currentStaffRequestRateLimit / 1000 / 60 : 5) ||
        customBotToken !== (currentCustomBotToken || "") ||
        customBotEnabled !== (currentCustomBotEnabled || false) ||
        isFeatureLoa !== featureLoa ||
        isFeatureStaffReq !== featureStaffReq ||
        isFeaturePermLog !== featurePermLog ||
        webhookUrl !== (currentWebhookUrl || "") ||
        JSON.stringify(webhookEvents) !== JSON.stringify(currentWebhookEvents ? JSON.parse(currentWebhookEvents) : [])

    const handleReset = () => {
        setName(currentName)
        setBannerUrl(currentBanner || "")
        setOnDutyRoleId(currentOnDutyRoleId || "")
        setDiscordGuildId(currentDiscordGuildId || "")
        setAutoSyncRoles(currentAutoSyncRoles)
        setSuspendedRoleId(currentSuspendedRoleId || "")
        setTerminatedRoleId(currentTerminatedRoleId || "")
        setStaffRoleId(currentStaffRoleId || "")
        setPermLogChannelId(currentPermLogChannelId || "")
        setStaffRequestChannelId(currentStaffRequestChannelId || "")
        setRaidAlertChannelId(currentRaidAlertChannelId || "")
        setCommandLogChannelId(currentCommandLogChannelId || "")
        setMilestoneChannelId(currentMilestoneChannelId || "")
        setLoaChannelId(currentLoaChannelId || "")
        setOnLoaRoleId(currentOnLoaRoleId || "")
        setMaxUploadSize(currentMaxUploadSize ? currentMaxUploadSize / 1024 / 1024 : 50)
        setStaffRequestRateLimit(currentStaffRequestRateLimit ? currentStaffRequestRateLimit / 1000 / 60 : 5)
        setCustomBotToken(currentCustomBotToken || "")
        setCustomBotEnabled(currentCustomBotEnabled || false)
        setIsFeatureLoa(featureLoa)
        setIsFeatureStaffReq(featureStaffReq)
        setIsFeaturePermLog(featurePermLog)
        setWebhookUrl(currentWebhookUrl || "")
        try {
            setWebhookEvents(currentWebhookEvents ? JSON.parse(currentWebhookEvents) : [])
        } catch (e) {
            setWebhookEvents([])
        }
    }

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
                    milestoneChannelId: milestoneChannelId || null,
                    loaChannelId: loaChannelId || null,
                    onLoaRoleId: onLoaRoleId || null,
                    customBotToken: customBotToken || null,
                    customBotEnabled,
                    maxUploadSize: maxUploadSize * 1024 * 1024,
                    staffRequestRateLimit: staffRequestRateLimit * 1000 * 60,
                    featureLoa: isFeatureLoa,
                    featureStaffReq: isFeatureStaffReq,
                    featurePermLog: isFeaturePermLog,
                    webhookUrl: webhookUrl || null,
                    webhookEvents: webhookEvents
                })
            })

            if (res.ok) {
                setMessage("Settings saved!")
                // Briefly show success message then just rely on the bar disappearing (because props will update eventually or we can manually refresh)
                // In a real Next.js app, router.refresh() would update the props.
                window.location.reload()
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
        const confirmed = await showConfirm("Confirm Action", "Are you sure you want to perform this action?", "Proceed", "destructive")
        if (!confirmed) return

        setDangerLoading(true)
        try {
            const res = await fetch("/api/admin/server/danger", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serverId, action, value })
            })

            const data = await res.json()
            if (res.ok) {
                await showAlert("Success", data.message || "Action successful", "success")
                if (action === "TRANSFER_OWNERSHIP") window.location.href = "/dashboard"
            } else {
                await showAlert("Error", data.error || "Action failed", "error")
            }
        } catch (e) {
            await showAlert("Error", "An error occurred", "error")
        } finally {
            setDangerLoading(false)
        }
    }

    const handleDeleteServer = async () => {
        if (deleteConfirm.trim() !== name.trim()) {
            await showAlert("Name Mismatch", "Please type the server name correctly to confirm deletion.", "warning")
            return
        }

        const confirmed = await showConfirm("Delete Server", "FINAL WARNING: This will permanently delete all logs, punishments, and data for this server. This cannot be undone. Proceed?", "DELETE", "destructive")
        if (!confirmed) return

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
                await showAlert("Error", data.error || "Failed to delete server", "error")
            }
        } catch (e) {
            await showAlert("Error", "An error occurred", "error")
        } finally {
            setDangerLoading(false)
        }
    }

    const CATEGORIES = [
        { id: "general", name: "General", icon: LayoutDashboard },
        { id: "features", name: "Features", icon: Zap },
        { id: "discord", name: "Discord & Channels", icon: MessageSquare },
        { id: "roles", name: "Roles & Access", icon: Users },
        { id: "analytics", name: "Limits & Quotas", icon: BarChart3 },
        { id: "webhooks", name: "Webhooks", icon: Globe },
        { id: "white-label", name: "White Label", icon: ShieldCheck },
        { id: "danger", name: "Danger Zone", icon: AlertTriangle }
    ]

    return (
        <div className="flex flex-col gap-8 pb-32">
            {/* PRC Policy Alerts */}
            {deletionScheduledAt && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500 max-w-4xl mx-auto w-full">
                    <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-red-400 font-bold text-sm text-left">Server Marked for Deletion</h3>
                        <p className="text-xs text-red-400/70 mt-1 text-left">
                            The Project Overwatch bot has been removed from your Discord server. Per PRC policy, this POW server will be <b>permanently deleted</b> after a 24-hour grace period unless the bot is re-added.
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                            <Link
                                href={`https://discord.com/api/oauth2/authorize?client_id=1449823310383939725&permissions=8&scope=bot%20applications.commands`}
                                target="_blank"
                                className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[10px] font-black transition-all"
                            >
                                RE-ADD BOT
                            </Link>
                            <span className="text-[10px] text-red-400/50 uppercase font-black tracking-widest">
                                Scheduled: {new Date(deletionScheduledAt).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {botMissingPermissions && !deletionScheduledAt && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500 max-w-4xl mx-auto w-full">
                    <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                        <ShieldCheck className="h-5 w-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-amber-400 font-bold text-sm text-left">Missing Bot Permissions</h3>
                        <p className="text-xs text-amber-400/70 mt-1 text-left">
                            The bot is unable to synchronize slash commands. Please ensure the bot has the <b>Application Commands</b> scope and sufficient permissions (Manage Roles, View Channels) in your Discord server.
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                            <button
                                onClick={handleSyncCommands}
                                disabled={isSyncing}
                                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black transition-all flex items-center gap-2"
                            >
                                {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                RE-SYNC COMMANDS
                            </button>
                            <Link
                                href={`https://discord.com/api/oauth2/authorize?client_id=1449823310383939725&permissions=8&scope=bot%20applications.commands`}
                                target="_blank"
                                className="text-[10px] text-amber-400/70 hover:text-amber-400 underline font-bold"
                            >
                                Fix Scopes
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex gap-8 items-start min-h-[600px]">
                {/* Sidebar Navigation */}
                <div className="w-64 sticky top-6 space-y-1 flex-shrink-0">
                    <div className="px-3 mb-4">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Settings</h3>
                    </div>
                    {CATEGORIES.map((cat) => {
                        const Icon = cat.icon
                        const isActive = activeCategory === cat.id
                        if (cat.id === "danger" && !isOwner) return null
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all group ${isActive
                                    ? "bg-indigo-500/10 text-indigo-400"
                                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                                    }`}
                            >
                                <Icon className={`h-4 w-4 ${isActive ? "text-indigo-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
                                {cat.name}
                            </button>
                        )
                    })}
                </div>

                {/* Content Area */}
                <div className="flex-1 max-w-3xl animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="bg-[#111] border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
                        <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
                            {(() => {
                                const Icon = CATEGORIES.find(c => c.id === activeCategory)?.icon
                                return Icon ? <Icon className="h-24 w-24" /> : null
                            })()}
                        </div>

                        <div className="relative z-10 space-y-8">
                            <div>
                                <h2 className="text-2xl font-bold text-white">{CATEGORIES.find(c => c.id === activeCategory)?.name}</h2>
                                <p className="text-sm text-zinc-500">Configure your server's {CATEGORIES.find(c => c.id === activeCategory)?.name.toLowerCase()} settings.</p>
                            </div>

                            {activeCategory === "general" && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-400 mb-2">Display Name</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                                            placeholder="Server name..."
                                        />
                                        <p className="text-xs text-zinc-600 mt-2">This name will be displayed on the dashboard and in-game</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-400 mb-2">Banner Image URL</label>
                                        <input
                                            type="url"
                                            value={bannerUrl}
                                            onChange={(e) => setBannerUrl(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                                            placeholder="https://example.com/banner.png"
                                        />
                                        <p className="text-[10px] text-zinc-500 mt-2">Recommended resolution: <span className="text-zinc-300 font-bold">1200x400</span> (3:1 ratio). Keep important content centered as cropping may occur on different screen sizes.</p>
                                        {bannerUrl && (
                                            <div className="mt-4 rounded-2xl overflow-hidden border border-white/10 shadow-lg aspect-[3/1] w-full max-w-md">
                                                <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeCategory === "features" && (
                                <div className="space-y-4">
                                    {[
                                        { id: "loa", name: "Leave of Absence", desc: "Enable the LOA module for staff requests.", state: isFeatureLoa, setState: setIsFeatureLoa },
                                        { id: "staff", name: "Staff Requests", desc: "Allow users to request mod support in-game.", state: isFeatureStaffReq, setState: setIsFeatureStaffReq },
                                        { id: "perm", name: "Permission Logs", desc: "Enable tracking for permission changes.", state: isFeaturePermLog, setState: setIsFeaturePermLog }
                                    ].map((feature) => (
                                        <div key={feature.id} className="flex items-center justify-between p-4 bg-zinc-900/40 rounded-2xl border border-white/5">
                                            <div>
                                                <p className="text-white font-medium">{feature.name}</p>
                                                <p className="text-xs text-zinc-500">{feature.desc}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => feature.setState(!feature.state)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${feature.state ? 'bg-indigo-500' : 'bg-zinc-800'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${feature.state ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeCategory === "discord" && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-400 mb-2">Guild ID</label>
                                        <input
                                            type="text"
                                            value={discordGuildId}
                                            onChange={(e) => setDiscordGuildId(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                                            placeholder="1234..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Perm Logs</label>
                                            <ChannelCombobox serverId={serverId} value={permLogChannelId} onChange={(v) => setPermLogChannelId(v || "")} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Command Logs</label>
                                            <ChannelCombobox serverId={serverId} value={commandLogChannelId} onChange={(v) => setCommandLogChannelId(v || "")} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Staff Requests</label>
                                            <ChannelCombobox serverId={serverId} value={staffRequestChannelId} onChange={(v) => setStaffRequestChannelId(v || "")} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Raid Alerts</label>
                                            <ChannelCombobox serverId={serverId} value={raidAlertChannelId} onChange={(v) => setRaidAlertChannelId(v || "")} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Milestones</label>
                                            <ChannelCombobox serverId={serverId} value={milestoneChannelId} onChange={(v) => setMilestoneChannelId(v || "")} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">LOA Channel</label>
                                            <ChannelCombobox serverId={serverId} value={loaChannelId} onChange={(v) => setLoaChannelId(v || "")} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeCategory === "roles" && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">On-Duty Role</label>
                                            <RoleCombobox serverId={serverId} value={onDutyRoleId} onChange={(v) => setOnDutyRoleId(v || "")} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Staff/Viewer Role</label>
                                            <RoleCombobox serverId={serverId} value={staffRoleId} onChange={(v) => setStaffRoleId(v || "")} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Suspended Role</label>
                                            <RoleCombobox serverId={serverId} value={suspendedRoleId} onChange={(v) => setSuspendedRoleId(v || "")} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Terminated Role</label>
                                            <RoleCombobox serverId={serverId} value={terminatedRoleId} onChange={(v) => setTerminatedRoleId(v || "")} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">On-LOA Role</label>
                                            <RoleCombobox serverId={serverId} value={onLoaRoleId} onChange={(v) => setOnLoaRoleId(v || "")} />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-zinc-900/40 rounded-2xl border border-white/5">
                                        <div>
                                            <p className="text-white font-medium">Auto Role Sync</p>
                                            <p className="text-xs text-zinc-500">Sync panel roles with Discord every 10 seconds.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setAutoSyncRoles(!autoSyncRoles)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoSyncRoles ? 'bg-indigo-500' : 'bg-zinc-800'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoSyncRoles ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeCategory === "analytics" && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-400 mb-2 font-bold">Staff Request Rate Limit (Minutes)</label>
                                        <input
                                            type="number"
                                            value={staffRequestRateLimit}
                                            onChange={(e) => setStaffRequestRateLimit(parseInt(e.target.value))}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                                        />
                                        <p className="text-xs text-zinc-600 mt-2">Cooldown period between in-game staff requests per player.</p>
                                    </div>
                                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                                        <p className="text-xs text-indigo-300">File uploads are standardized to **100MB** per submission and cannot be changed.</p>
                                    </div>
                                </div>
                            )}

                            {activeCategory === "webhooks" && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-400 mb-2">Discord Webhook URL</label>
                                        <input
                                            type="url"
                                            value={webhookUrl}
                                            onChange={(e) => setWebhookUrl(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                                            placeholder="https://discord.com/api/webhooks/..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { id: "PUNISHMENT_CREATED", name: "Punishments" },
                                            { id: "SHIFT_START", name: "Shift Starts" },
                                            { id: "SHIFT_END", name: "Shift Ends" },
                                            { id: "BOLO_CREATED", name: "BOLO Created" },
                                            { id: "LOA_REQUESTED", name: "LOA Requested" }
                                        ].map((event) => (
                                            <label key={event.id} className="flex items-center gap-3 p-3 bg-zinc-900/40 border border-white/5 rounded-xl cursor-pointer hover:bg-indigo-500/5 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={webhookEvents.includes(event.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setWebhookEvents([...webhookEvents, event.id])
                                                        else setWebhookEvents(webhookEvents.filter(id => id !== event.id))
                                                    }}
                                                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-0 transition-all"
                                                />
                                                <span className="text-sm text-zinc-300">{event.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeCategory === "white-label" && (
                                <div className="space-y-6">
                                    {subscriptionPlan !== "pow-max" ? (
                                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-6">
                                            <p className="text-purple-400 text-sm mb-4 font-medium">Upgrade Required: The White Label Bot feature requires a POW Max subscription.</p>
                                            <Link href="/pricing" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-xl text-sm font-bold transition-all inline-block shadow-lg shadow-purple-500/20">Upgrade to Max</Link>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20">
                                                <div>
                                                    <p className="text-white font-medium">Enable Custom Bot</p>
                                                    <p className="text-xs text-zinc-500">Run role sync and notifications through your own bot.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setCustomBotEnabled(!customBotEnabled)}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${customBotEnabled ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${customBotEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                                </button>
                                            </div>
                                            {customBotEnabled && (
                                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                                    <label className="block text-sm font-medium text-zinc-400 mb-2">Bot Token</label>
                                                    <input
                                                        type="password"
                                                        value={customBotToken}
                                                        onChange={(e) => setCustomBotToken(e.target.value)}
                                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                                                        placeholder="MTAx..."
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeCategory === "danger" && isOwner && (
                                <div className="space-y-8">
                                    <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-2xl space-y-4">
                                        <div>
                                            <h4 className="font-bold text-white mb-1">Change PRC API Key</h4>
                                            <p className="text-xs text-zinc-500">Update the link with your PRC server instance.</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="password"
                                                value={newApiKey}
                                                onChange={(e) => setNewApiKey(e.target.value)}
                                                placeholder="Enter key..."
                                                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-red-500"
                                            />
                                            <button
                                                onClick={() => handleDangerAction("CHANGE_API_KEY", newApiKey)}
                                                disabled={dangerLoading || !newApiKey}
                                                className="px-6 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-bold border border-red-500/20"
                                            >
                                                Update
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-2xl space-y-4">
                                        <div>
                                            <h4 className="font-bold text-white mb-1 text-orange-400">Transfer Ownership</h4>
                                            <p className="text-xs text-zinc-500">Transfer control to another server member.</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <select
                                                value={targetOwnerId}
                                                onChange={(e) => setTargetOwnerId(e.target.value)}
                                                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-orange-500/50"
                                            >
                                                <option value="">Select a member...</option>
                                                {serverMembers?.filter(m => m.id !== serverId).map(member => (
                                                    <option key={member.id} value={member.id}>{member.name || member.id}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => handleDangerAction("TRANSFER_OWNERSHIP", targetOwnerId)}
                                                disabled={dangerLoading || !targetOwnerId}
                                                className="px-6 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 text-sm font-bold border border-orange-500/20"
                                            >
                                                Transfer
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl space-y-4 shadow-[0_0_50px_-20px_rgba(239,68,68,0.3)]">
                                        <div>
                                            <h4 className="font-extrabold text-red-500 mb-1 uppercase tracking-tighter">Delete Server</h4>
                                            <p className="text-xs text-zinc-500">Permanently remove all data. Type <span className="text-white font-mono">{name}</span> to confirm.</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={deleteConfirm}
                                                onChange={(e) => setDeleteConfirm(e.target.value)}
                                                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-red-500"
                                            />
                                            <button
                                                onClick={handleDeleteServer}
                                                disabled={dangerLoading || deleteConfirm !== name}
                                                className="px-6 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-30 transition-all"
                                            >
                                                DELETE
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Unsaved Changes Bar */}
                {isDirty && (
                    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-6 animate-in fade-in slide-in-from-bottom-full duration-700 cubic-bezier(0.16, 1, 0.3, 1)">
                        <div className="bg-black/80 border border-white/10 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between gap-6 backdrop-blur-3xl">
                            {/* Left balancing spacer */}
                            <div className="hidden sm:block flex-1" />

                            {/* Centered Content */}
                            <div className="flex items-center gap-4 shrink-0 px-2">
                                <div className="h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center shadow-inner border border-white/5">
                                    <RefreshCw className="h-5 w-5 text-indigo-400 animate-spin-slow" />
                                </div>
                                <p className="text-white font-bold text-lg tracking-tight whitespace-nowrap">Unsaved changes</p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex-1 flex items-center justify-end gap-2.5">
                                <button
                                    onClick={handleReset}
                                    className="px-5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold transition-all flex items-center gap-2 border border-white/5 active:scale-95"
                                >
                                    <RotateCcw className="h-4 w-4" /> Reset
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-8 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black shadow-[0_8px_20px_rgba(79,70,229,0.3)] transition-all flex items-center gap-2.5 disabled:opacity-50 active:scale-95"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    SAVE
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
