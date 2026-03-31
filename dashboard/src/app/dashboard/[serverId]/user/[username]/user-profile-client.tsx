
"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Shield, Ban, AlertTriangle, Gavel, Calendar, User, History, Clock, Siren, ScrollText, Car, Radio, Users, Star, Crown, Wifi, WifiOff, StopCircle, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { PunishmentForm } from "./punishment-form"
import { LogViewer } from "@/components/logs/log-viewer"
import { usePermissions } from "@/components/auth/role-sync-wrapper"
import { useDialog } from "@/components/providers/dialog-provider"

interface RobloxUser {
    id: number
    name: string
    displayName: string
    created: string
    avatar?: string
}

interface PlayerStatus {
    online: boolean
    name?: string
    id?: string
    team?: string
    vehicle?: string | null
    callsign?: string | null
    permission?: number | string  // Can be number (0,1,2) or string ("Server Moderator", "Server Administrator")
    staffInfo?: {
        isStaff: boolean
        roleName: string | null
        isOnDuty: boolean
        shiftStart: string | null
        discordId: string | null
        isAdmin: boolean
    } | null
}

export function UserProfileClient({ serverId, username }: { serverId: string, username: string }) {
    const [robloxUser, setRobloxUser] = useState<RobloxUser | null>(null)
    const [punishments, setPunishments] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [robloxWarning, setRobloxWarning] = useState("") // Warning for partial panel
    const [playerStatus, setPlayerStatus] = useState<PlayerStatus | null>(null)
    const { permissions } = usePermissions()
    const { showConfirm } = useDialog()
    // Admin shift management state
    const [isAdmin, setIsAdmin] = useState(false)
    const [weeklyShifts, setWeeklyShifts] = useState<any[]>([])
    const [activeShift, setActiveShift] = useState<any>(null)
    const [showShifts, setShowShifts] = useState(false)
    const [shiftLoading, setShiftLoading] = useState(false)

    // Main data loading effect - optimized with parallel fetches
    useEffect(() => {
        const load = async () => {
            try {
                // Start all fetches in parallel
                const robloxPromise = fetch(`/api/roblox/user?username=${encodeURIComponent(username)}`)
                const statusPromise = fetch(`/api/players/status?serverId=${serverId}&username=${encodeURIComponent(username)}`)
                const adminPromise = fetch(`/api/admin/status?serverId=${serverId}`)

                // Wait for Roblox user first (needed for other data)
                let userStart = null
                let serverError = null

                try {
                    const serverRes = await robloxPromise
                    if (serverRes.ok) {
                        userStart = await serverRes.json()
                    } else if (serverRes.status === 404) {
                        serverError = "not_found"
                    } else {
                        serverError = "server_error"
                    }
                } catch (err) {
                    serverError = "network_error"
                }

                // Handle player status (already fetching in parallel)
                try {
                    const statusRes = await statusPromise
                    if (statusRes.ok) {
                        setPlayerStatus(await statusRes.json())
                    }
                } catch (e) { }

                // Handle admin status - use local variable since React state isn't available immediately
                let isAdminLocal = false
                try {
                    const adminRes = await adminPromise
                    if (adminRes.ok) {
                        const data = await adminRes.json()
                        isAdminLocal = data.isAdmin
                        setIsAdmin(isAdminLocal)
                    }
                } catch (e) { }

                if (userStart) {
                    setRobloxUser(userStart)

                    // Fetch punishments and shifts in parallel (use isAdminLocal, not state)
                    const [punRes, shiftsRes] = await Promise.all([
                        fetch(`/api/punishments?serverId=${serverId}&userId=${userStart.id}`),
                        isAdminLocal ? fetch(`/api/admin/shifts?serverId=${serverId}&userId=${userStart.id}`) : Promise.resolve(null)
                    ])

                    if (punRes.ok) {
                        const punData = await punRes.json()
                        setPunishments(Array.isArray(punData) ? punData : (punData.items || []))
                    }

                    if (shiftsRes?.ok) {
                        const shiftsData = await shiftsRes.json()
                        setWeeklyShifts(shiftsData.shifts || [])
                        setActiveShift(shiftsData.activeShift)
                    }
                } else {
                    // Fallback: check logs
                    try {
                        const logsRes = await fetch(`/api/logs?serverId=${serverId}&query=${encodeURIComponent(username)}&limit=1`)
                        if (logsRes.ok) {
                            const logsData = await logsRes.json()
                            if (logsData.length > 0) {
                                const firstLog = logsData[0]
                                setRobloxUser({
                                    id: parseInt(firstLog.PlayerId) || 0,
                                    name: username,
                                    displayName: username,
                                    created: "",
                                    avatar: undefined
                                })
                                setRobloxWarning("Roblox profile data temporarily unavailable. Showing partial data from logs.")
                            } else {
                                setError("User not found on Roblox and no logs found.")
                            }
                        } else {
                            setError(serverError === "not_found" ? "User not found on Roblox" : "Roblox API temporarily unavailable.")
                        }
                    } catch (e) {
                        setError("Roblox API temporarily unavailable.")
                    }
                }
            } catch (e) {
                console.error(e)
                setError("Failed to load user data")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [serverId, username])

    // Polling for live player status updates
    useEffect(() => {
        if (!robloxUser) return

        const fetchStatus = async () => {
            try {
                const res = await fetch(`/api/players/status?serverId=${serverId}&username=${encodeURIComponent(username)}&userId=${robloxUser.id}`)
                if (res.ok) setPlayerStatus(await res.json())
            } catch (e) { }
        }

        const interval = setInterval(fetchStatus, 10000)
        return () => clearInterval(interval)
    }, [serverId, username, robloxUser])

    // End a user's shift
    const handleEndShift = async () => {
        if (!robloxUser || !activeShift) return
        setShiftLoading(true)

        try {
            const res = await fetch('/api/admin/shifts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-check': '1'
                },
                body: JSON.stringify({
                    serverId,
                    userId: robloxUser.id.toString(),
                    shiftId: activeShift.id
                })
            })

            if (res.ok) {
                const shiftsRes = await fetch(`/api/admin/shifts?serverId=${serverId}&userId=${robloxUser.id}`)
                if (shiftsRes.ok) {
                    const data = await shiftsRes.json()
                    setWeeklyShifts(data.shifts || [])
                    setActiveShift(data.activeShift)
                }
            }
        } catch (e) {
            console.error("Failed to end shift", e)
        } finally {
            setShiftLoading(false)
        }
    }

    // Delete a shift
    const handleDeleteShift = async (shiftId: string) => {
        const confirmed = await showConfirm("Delete Shift", "Are you sure you want to delete this shift? This will remove it from quota calculations.", "Delete", "destructive")
        if (!confirmed) return
        setShiftLoading(true)

        try {
            const res = await fetch(`/api/admin/shifts?serverId=${serverId}&shiftId=${shiftId}`, {
                method: 'DELETE',
                headers: { 'x-csrf-check': '1' }
            })

            if (res.ok) {
                setWeeklyShifts(prev => prev.filter(s => s.id !== shiftId))
            }
        } catch (e) {
            console.error("Failed to delete shift", e)
        } finally {
            setShiftLoading(false)
        }
    }

    // Format duration helper
    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        return `${h}h ${m}m`
    }

    if (loading) return <div className="p-12 text-center text-zinc-500">Loading profile...</div>
    if (error || !robloxUser) return (
        <div className="min-h-screen bg-[#111] flex items-center justify-center p-8">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-white mb-2">User Not Found</h1>
                <p className="text-zinc-500">{error || `Could not find user "${username}"`}</p>
                <a href={`/dashboard/${serverId}/mod-panel`} className="inline-block mt-4 text-indigo-400 hover:text-indigo-300">
                    Return to Mod Panel
                </a>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-[#111] text-zinc-100 font-sans p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
                <a href={`/dashboard/${serverId}/mod-panel`} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white">
                    <ArrowLeft className="h-5 w-5" />
                </a>
                <h1 className="text-2xl font-bold text-white tracking-tight">Player Profile</h1>
            </div>

            {/* Warning Banner for Partial Data */}
            {robloxWarning && (
                <div className="max-w-7xl mx-auto mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
                    <div>
                        <p className="text-amber-400 font-medium">Partial Data</p>
                        <p className="text-amber-400/70 text-sm">{robloxWarning}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                {/* LEFT COLUMN */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a] text-center">
                        <div className="w-32 h-32 mx-auto rounded-full bg-zinc-800 overflow-hidden mb-4 border-4 border-[#222] shadow-xl">
                            {robloxUser.avatar ? (
                                <img src={robloxUser.avatar} alt={robloxUser.name} className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-full h-full p-6 text-zinc-600" />
                            )}
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-1">{robloxUser.displayName}</h2>
                        <p className="text-zinc-500 font-mono text-sm mb-6">@{robloxUser.name}</p>

                        <div className="grid grid-cols-2 gap-4 text-left p-4 bg-[#222] rounded-xl text-sm border border-[#333]">
                            <div>
                                <p className="text-zinc-500 text-xs mb-1">Roblox ID</p>
                                <p className="font-mono text-white">{robloxUser.id || "Unknown"}</p>
                            </div>
                            <div>
                                <p className="text-zinc-500 text-xs mb-1">Joined</p>
                                <p className="text-white">{robloxUser.created ? new Date(robloxUser.created).toLocaleDateString() : "Unknown"}</p>
                            </div>
                        </div>
                    </div>

                    {/* Live Status Card */}
                    <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-[#2a2a2a]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                {playerStatus?.online ? (
                                    <Wifi className="h-4 w-4 text-emerald-400" />
                                ) : (
                                    <WifiOff className="h-4 w-4 text-zinc-500" />
                                )}
                                Live Status
                            </h3>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${playerStatus?.online
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-zinc-700/50 text-zinc-500"
                                }`}>
                                {playerStatus?.online ? "ONLINE" : "OFFLINE"}
                            </span>
                        </div>

                        {playerStatus?.online ? (
                            <div className="space-y-3">
                                {/* Team */}
                                <div className="flex items-center gap-3 p-3 bg-[#222] rounded-lg border border-[#333]">
                                    <Users className="h-4 w-4 text-zinc-400" />
                                    <div className="flex-1">
                                        <p className="text-zinc-500 text-xs">Team</p>
                                        <p className={`font-medium ${playerStatus.team?.toLowerCase().includes("sheriff") ? "text-amber-400" :
                                            playerStatus.team?.toLowerCase().includes("police") || playerStatus.team?.toLowerCase().includes("pd") ? "text-blue-400" :
                                                playerStatus.team?.toLowerCase().includes("fire") || playerStatus.team?.toLowerCase().includes("ems") ? "text-red-400" :
                                                    playerStatus.team?.toLowerCase().includes("dot") ? "text-orange-400" :
                                                        "text-zinc-300"
                                            }`}>
                                            {playerStatus.team || "Civilian"}
                                        </p>
                                    </div>
                                </div>

                                {/* Callsign (only if not Civilian) */}
                                {playerStatus.callsign && playerStatus.callsign !== "" && (
                                    <div className="flex items-center gap-3 p-3 bg-[#222] rounded-lg border border-[#333]">
                                        <Radio className="h-4 w-4 text-zinc-400" />
                                        <div className="flex-1">
                                            <p className="text-zinc-500 text-xs">Callsign</p>
                                            <p className="font-bold text-white">{playerStatus.callsign}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Vehicle */}
                                {playerStatus.vehicle && playerStatus.vehicle !== "None" && playerStatus.vehicle !== "" && (
                                    <div className="flex items-center gap-3 p-3 bg-[#222] rounded-lg border border-[#333]">
                                        <Car className="h-4 w-4 text-zinc-400" />
                                        <div className="flex-1">
                                            <p className="text-zinc-500 text-xs">Vehicle</p>
                                            <p className="text-white">{playerStatus.vehicle}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Permission Level */}
                                {(playerStatus.permission === "Server Administrator" || playerStatus.permission === "Server Moderator" ||
                                    (typeof playerStatus.permission === "number" && playerStatus.permission > 0)) && (
                                        <div className={`flex items-center gap-3 p-3 rounded-lg border ${playerStatus.permission === "Server Administrator" || playerStatus.permission === 2
                                            ? "bg-purple-500/10 border-purple-500/30"
                                            : "bg-amber-500/10 border-amber-500/30"
                                            }`}>
                                            {playerStatus.permission === "Server Administrator" || playerStatus.permission === 2 ? (
                                                <Crown className="h-4 w-4 text-purple-400" />
                                            ) : (
                                                <Star className="h-4 w-4 text-amber-400" />
                                            )}
                                            <div className="flex-1">
                                                <p className={`font-bold ${playerStatus.permission === "Server Administrator" || playerStatus.permission === 2
                                                    ? "text-purple-400"
                                                    : "text-amber-400"
                                                    }`}>
                                                    {playerStatus.permission === "Server Administrator" || playerStatus.permission === 2
                                                        ? "Admin"
                                                        : "Mod"}
                                                </p>
                                                <p className="text-xs text-zinc-500">In-Game Permission</p>
                                            </div>
                                        </div>
                                    )}
                            </div>
                        ) : (
                            <p className="text-zinc-500 text-sm text-center py-4">
                                Player is not currently in the server.
                            </p>
                        )}
                    </div>

                    {/* Staff Info Card (only if registered staff) */}
                    {playerStatus?.staffInfo?.isStaff && (
                        <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-[#2a2a2a]">
                            <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                                <Shield className="h-4 w-4 text-indigo-400" />
                                Staff Info
                            </h3>
                            <div className="space-y-3">
                                {/* Role */}
                                {playerStatus.staffInfo.roleName && (
                                    <div className="flex items-center justify-between p-3 bg-[#222] rounded-lg border border-[#333]">
                                        <span className="text-zinc-500 text-sm">POW Role</span>
                                        <span className="text-white font-medium">{playerStatus.staffInfo.roleName}</span>
                                    </div>
                                )}

                                {/* Duty Status */}
                                <div className="flex items-center justify-between p-3 bg-[#222] rounded-lg border border-[#333]">
                                    <span className="text-zinc-500 text-sm">Shift Status</span>
                                    <span className={`font-bold ${playerStatus.staffInfo.isOnDuty ? "text-emerald-400" : "text-zinc-500"
                                        }`}>
                                        {playerStatus.staffInfo.isOnDuty ? "On Duty" : "Off Duty"}
                                    </span>
                                </div>

                                {/* Discord ID */}
                                {playerStatus.staffInfo.discordId && (
                                    <div className="flex items-center justify-between p-3 bg-[#222] rounded-lg border border-[#333]">
                                        <span className="text-zinc-500 text-sm">Discord</span>
                                        <span className="text-white font-mono text-sm">{playerStatus.staffInfo.discordId}</span>
                                    </div>
                                )}

                                {/* Admin Badge */}
                                {playerStatus.staffInfo.isAdmin && (
                                    <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30 text-center">
                                        <span className="text-amber-400 font-bold text-sm">⭐ Server Admin</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Admin Shift Management Card - SEPARATE from Staff Info */}
                    {isAdmin && robloxUser && (
                        <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-[#2a2a2a]">
                            <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                                <Shield className="h-4 w-4 text-red-400" />
                                Admin Controls
                            </h3>

                            {/* Current Shift Status */}
                            <div className="flex items-center justify-between p-3 bg-[#222] rounded-lg border border-[#333] mb-3">
                                <span className="text-zinc-500 text-sm">Shift Status</span>
                                <span className={`font-bold ${activeShift ? "text-emerald-400" : "text-zinc-500"}`}>
                                    {activeShift ? "On Duty" : "Off Duty"}
                                </span>
                            </div>

                            {/* End Shift Button */}
                            {activeShift && (
                                <button
                                    onClick={handleEndShift}
                                    disabled={shiftLoading}
                                    className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                                >
                                    <StopCircle className="h-4 w-4" />
                                    {shiftLoading ? "Ending..." : "End Their Shift"}
                                </button>
                            )}

                            {/* View Weekly Shifts */}
                            <button
                                onClick={() => setShowShifts(!showShifts)}
                                className="w-full flex items-center justify-between px-4 py-2 bg-[#222] rounded-lg hover:bg-[#2a2a2a] transition-colors"
                            >
                                <span className="text-zinc-300 text-sm">Weekly Shifts ({weeklyShifts.length})</span>
                                {showShifts ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                            </button>

                            {/* Shifts List */}
                            {showShifts && (
                                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                                    {weeklyShifts.length === 0 ? (
                                        <p className="text-zinc-500 text-sm text-center py-2">No shifts this week</p>
                                    ) : (
                                        weeklyShifts.map((shift: any) => (
                                            <div key={shift.id} className="flex items-center justify-between p-2 bg-[#222] rounded-lg text-sm">
                                                <div>
                                                    <p className="text-zinc-300">
                                                        {new Date(shift.startTime).toLocaleDateString()} • {shift.duration ? formatDuration(shift.duration) : 'Active'}
                                                    </p>
                                                    <p className="text-zinc-500 text-xs">
                                                        {new Date(shift.startTime).toLocaleTimeString()} - {shift.endTime ? new Date(shift.endTime).toLocaleTimeString() : 'now'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteShift(shift.id)}
                                                    disabled={shiftLoading}
                                                    className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                                                    title="Delete shift"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Action Box - Gated */}
                    {(permissions.canIssueWarnings || permissions.canKick || permissions.canBan || permissions.canBanBolo) && (
                        <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a]">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                    <Gavel className="h-5 w-5 text-indigo-500" />
                                    Issue Punishment
                                </h3>
                            </div>
                            <PunishmentForm
                                serverId={serverId}
                                userId={robloxUser.id.toString()}
                                username={robloxUser.name}
                            />
                        </div>
                    )}

                    {/* History - Gated */}
                    {permissions.canViewPunishments && (
                        <div className="bg-[#1a1a1a] rounded-2xl overflow-hidden border border-[#2a2a2a]">
                            <div className="p-6 border-b border-[#2a2a2a]">
                                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                    <History className="h-5 w-5 text-zinc-400" />
                                    Punishment History
                                </h3>
                            </div>
                            <div className="divide-y divide-[#2a2a2a]">
                                {punishments.length === 0 ? (
                                    <div className="p-8 text-center text-zinc-500">No prior punishments found.</div>
                                ) : (
                                    punishments
                                        .sort((a: any, b: any) => {
                                            // Sort: Unresolved BOLOs first, then by date desc
                                            if (a.type === 'Ban Bolo' && !a.resolved && !(b.type === 'Ban Bolo' && !b.resolved)) return -1
                                            if (!(a.type === 'Ban Bolo' && !a.resolved) && b.type === 'Ban Bolo' && !b.resolved) return 1
                                            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                                        })
                                        .map((p: any) => (
                                            <div key={p.id} className={`p-4 flex items-center gap-4 transition-colors ${p.type === 'Ban Bolo' && !p.resolved
                                                ? 'border-2 border-yellow-500 bg-yellow-500/5 mb-2 rounded-xl relative overflow-hidden'
                                                : 'hover:bg-[#222] border-b border-[#2a2a2a] last:border-0'
                                                }`}>
                                                {p.type === 'Ban Bolo' && !p.resolved && (
                                                    <div className="absolute top-0 right-0 p-1">
                                                        {/* Optional visual indicator */}
                                                    </div>
                                                )}

                                                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden relative ${p.type === 'Ban Bolo' ? 'bg-yellow-500/10 text-yellow-500' :
                                                    p.type === 'Ban' ? 'bg-red-500/10 text-red-500' :
                                                        p.type === 'Kick' ? 'bg-amber-500/10 text-amber-500' :
                                                            'bg-blue-500/10 text-blue-500'
                                                    }`}>
                                                    {p.moderatorAvatar ? (
                                                        <img src={p.moderatorAvatar} alt="Mod" className="w-full h-full object-cover" />
                                                    ) : (
                                                        p.type === 'Ban Bolo' ? <Siren className="h-5 w-5" /> :
                                                            p.type === 'Ban' ? <Ban className="h-5 w-5" /> :
                                                                p.type === 'Kick' ? <AlertTriangle className="h-5 w-5" /> :
                                                                    <Shield className="h-5 w-5" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-xs font-bold uppercase tracking-wider ${p.type === 'Ban Bolo' ? 'text-yellow-500' :
                                                            p.type === 'Ban' ? 'text-red-500' :
                                                                p.type === 'Kick' ? 'text-amber-500' :
                                                                    'text-blue-500'
                                                            }`}>{p.type}</span>
                                                        <span className="text-zinc-500 text-xs">•</span>
                                                        <span className="text-zinc-400 text-xs max-w-[200px] truncate">
                                                            {p.moderatorName ? (
                                                                <span className="text-zinc-300 font-medium">{p.moderatorName}</span>
                                                            ) : (
                                                                `Staff ID: ${p.moderatorId}`
                                                            )}
                                                        </span>
                                                    </div>
                                                    <p className="text-zinc-300 text-sm truncate">{p.reason || "No reason provided"}</p>
                                                </div>
                                                {p.type === 'Ban Bolo' && !p.resolved && permissions.canManageBolos && (
                                                    <button
                                                        onClick={async () => {
                                                            // Quick client-side update for responsiveness, then refresh
                                                            await fetch(`/api/resolve-bolo?id=${p.id}`, {
                                                                method: 'POST',
                                                                headers: { 'x-csrf-check': '1' }
                                                            })
                                                            window.location.reload()
                                                        }}
                                                        className="bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 px-3 py-1 rounded text-xs font-bold transition-colors"
                                                    >
                                                        Resolve
                                                    </button>
                                                )}
                                                <div className="text-right text-xs text-zinc-500 shrink-0">
                                                    <div className="flex items-center gap-1 justify-end mb-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(p.createdAt).toLocaleDateString()}
                                                    </div>
                                                    <div className="flex items-center gap-1 justify-end">
                                                        <Clock className="h-3 w-3" />
                                                        {new Date(p.createdAt).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* User Activity Logs */}
                    <div className="bg-[#1a1a1a] rounded-2xl overflow-hidden border border-[#2a2a2a]">
                        <div className="p-6 border-b border-[#2a2a2a]">
                            <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                <ScrollText className="h-5 w-5 text-indigo-400" />
                                User Activity
                            </h3>
                            <p className="text-zinc-500 text-sm mt-1">Logs involving this user (joins, kills, commands)</p>
                        </div>
                        <div className="h-[400px]">
                            <LogViewer serverId={serverId} compact={true} userId={robloxUser.id.toString()} username={robloxUser.name} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
