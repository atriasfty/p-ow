
"use client"

import { useState } from "react"
import { RefreshCw, Plus, Edit2, Trash2, Loader2, X, Check } from "lucide-react"
import { RoleCombobox } from "@/components/admin/role-combobox"

// New permission structure matching schema
interface RolePermissions {
    canShift: boolean
    canViewOtherShifts: boolean
    canViewLogs: boolean
    canViewPunishments: boolean
    canIssueWarnings: boolean
    canKick: boolean
    canBan: boolean
    canBanBolo: boolean
    canUseToolbox: boolean
    canManageBolos: boolean
    canRequestLoa: boolean
    canViewQuota: boolean
    canUseAdminCommands: boolean
    canAccessAdmin: boolean
}

interface Role {
    id: string
    name: string
    color: string
    quotaMinutes: number
    isDefault: boolean
    discordRoleId: string | null
    canShift: boolean
    canViewOtherShifts: boolean
    canViewLogs: boolean
    canViewPunishments: boolean
    canIssueWarnings: boolean
    canKick: boolean
    canBan: boolean
    canBanBolo: boolean
    canUseToolbox: boolean
    canManageBolos: boolean
    canRequestLoa: boolean
    canViewQuota: boolean
    canUseAdminCommands: boolean
    canAccessAdmin: boolean
    _count: { members: number }
}

interface Server {
    id: string
    name: string
    customName: string | null
}

interface RolesListProps {
    serverId: string
    roles: Role[]
    servers: Server[]
}

const PERMISSION_DETAILS: Record<keyof RolePermissions, { label: string, description: string }> = {
    canShift: { label: "Start/End Shifts", description: "Allows users to clock in and out using the shift button." },
    canViewOtherShifts: { label: "See Other Staff", description: "Allows seeing who else is currently on duty in the panel header." },
    canViewLogs: { label: "View Server Logs", description: "Grants access to the live log viewer (kills, joins, commands)." },
    canViewPunishments: { label: "View Punishments", description: "Allows viewing the punishment history of players." },
    canIssueWarnings: { label: "Issue Warnings", description: "Allows issuing formal warnings to players." },
    canKick: { label: "Kick Players", description: "Allows kicking players from the server." },
    canBan: { label: "Ban Players", description: "Allows banning players from the server." },
    canBanBolo: { label: "Ban & BOLO", description: "Allows issuing Bans with BOLO (Be On Look Out) status." },
    canUseToolbox: { label: "Use Toolbox", description: "Grants access to toolbox commands like Garmin and Run Command." },
    canManageBolos: { label: "Manage BOLOs", description: "Allows resolving active BOLO statuses." },
    canRequestLoa: { label: "Request LOA", description: "Allows submitting Leave of Absence requests." },
    canViewQuota: { label: "View Quota Stats", description: "Allows the user to see their own weekly quota progress." },
    canUseAdminCommands: { label: "Use Admin Commands", description: "Allows highly privileged commands (:mod, :admin, :unmod, etc.)" },
    canAccessAdmin: { label: "Admin Panel Access", description: "Grants automatic access to the server dashboard admin panel." }
}

const DEFAULT_PERMISSIONS: RolePermissions = {
    canShift: true,
    canViewOtherShifts: true,
    canViewLogs: true,
    canViewPunishments: true,
    canIssueWarnings: true,
    canKick: true,
    canBan: true,
    canBanBolo: true,
    canUseToolbox: true,
    canManageBolos: true,
    canRequestLoa: true,
    canViewQuota: true,
    canUseAdminCommands: false,
    canAccessAdmin: false
}

export function RolesList({ serverId, roles: initialRoles, servers }: RolesListProps) {
    const [roles, setRoles] = useState(initialRoles)
    const [syncing, setSyncing] = useState(false)
    const [editingRole, setEditingRole] = useState<Role | null>(null)
    const [creating, setCreating] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)

    // Form state
    const [formName, setFormName] = useState("")
    const [formColor, setFormColor] = useState("#6366f1")
    const [formQuota, setFormQuota] = useState(0)
    const [formDiscordRoleId, setFormDiscordRoleId] = useState("")
    const [formPerms, setFormPerms] = useState<RolePermissions>(DEFAULT_PERMISSIONS)

    const openEditor = (role?: Role) => {
        if (role) {
            setEditingRole(role)
            setFormName(role.name)
            setFormColor(role.color)
            setFormQuota(role.quotaMinutes)
            setFormDiscordRoleId(role.discordRoleId || "")
            setFormPerms({
                canShift: role.canShift,
                canViewOtherShifts: role.canViewOtherShifts,
                canViewLogs: role.canViewLogs,
                canViewPunishments: role.canViewPunishments,
                canIssueWarnings: role.canIssueWarnings,
                canKick: role.canKick,
                canBan: role.canBan,
                canBanBolo: role.canBanBolo,
                canUseToolbox: role.canUseToolbox,
                canManageBolos: role.canManageBolos,
                canRequestLoa: role.canRequestLoa,
                canViewQuota: role.canViewQuota,
                canUseAdminCommands: role.canUseAdminCommands,
                canAccessAdmin: role.canAccessAdmin
            })
        } else {
            setEditingRole(null)
            setFormName("")
            setFormColor("#6366f1")
            setFormQuota(0)
            setFormDiscordRoleId("")
            setFormPerms(DEFAULT_PERMISSIONS)
        }
        setCreating(true)
    }

    const handleSave = async () => {
        try {
            const res = await fetch("/api/admin/roles", {
                method: editingRole ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    serverId,
                    roleId: editingRole?.id,
                    name: formName,
                    color: formColor,
                    quotaMinutes: formQuota,
                    discordRoleId: formDiscordRoleId || null,
                    ...formPerms
                })
            })

            if (res.ok) {
                window.location.reload()
            }
        } catch (e) {
            console.error("Error saving role:", e)
        }
    }

    const handleDelete = async (roleId: string) => {
        setDeleting(roleId)

        try {
            const res = await fetch("/api/admin/roles", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roleId })
            })

            if (res.ok) {
                setRoles(prev => prev.filter(r => r.id !== roleId))
            }
        } catch (e) {
            console.error("Error deleting role:", e)
        } finally {
            setDeleting(null)
        }
    }

    const handleSyncRoles = async () => {
        setSyncing(true)

        try {
            await fetch("/api/admin/roles/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serverId })
            })
        } catch (e) {
            console.error("Error syncing roles:", e)
        } finally {
            setSyncing(false)
        }
    }

    const getEnabledPermCount = (role: Role) => {
        return Object.keys(PERMISSION_DETAILS).filter(key => role[key as keyof RolePermissions]).length
    }

    return (
        <div className="space-y-4">
            {/* Actions */}
            <div className="flex gap-2 justify-end">
                {servers.length > 1 && (
                    <button
                        onClick={handleSyncRoles}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                    >
                        {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Sync Roles Between Servers
                    </button>
                )}
                <button
                    onClick={() => openEditor()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Create Role
                </button>
            </div>

            {/* Roles Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {roles.map(role => (
                    <div
                        key={role.id}
                        className="bg-[#1a1a1a] rounded-xl border border-[#222] p-4"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div
                                    className="h-4 w-4 rounded-full"
                                    style={{ backgroundColor: role.color }}
                                />
                                <span className="font-medium text-white">{role.name}</span>
                                {role.isDefault && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-700 text-zinc-400">Default</span>
                                )}
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => openEditor(role)}
                                    className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(role.id)}
                                    disabled={deleting === role.id || role.isDefault}
                                    className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-50"
                                >
                                    {deleting === role.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="text-xs text-zinc-500 mb-3">
                            {role._count.members} member(s) • {role.quotaMinutes}min/week • {getEnabledPermCount(role)}/{Object.keys(PERMISSION_DETAILS).length} perms
                        </div>

                        {role.discordRoleId && (
                            <div className="text-xs text-indigo-400/60 mb-2">
                                Discord: {role.discordRoleId}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Role Editor Modal */}
            {creating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-[#1a1a1a] rounded-2xl border border-[#333] overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-[#222]">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-white">{editingRole ? "Edit Role" : "Create Role"}</h3>
                                <button onClick={() => setCreating(false)} className="p-2 hover:bg-white/10 rounded-lg">
                                    <X className="h-4 w-4 text-zinc-400" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">Name</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="Role name..."
                                />
                            </div>

                            {/* Color & Quota Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">Color</label>
                                    <input
                                        type="color"
                                        value={formColor}
                                        onChange={(e) => setFormColor(e.target.value)}
                                        className="w-12 h-12 rounded-lg cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">Weekly Quota (min)</label>
                                    <input
                                        type="number"
                                        value={formQuota}
                                        onChange={(e) => setFormQuota(parseInt(e.target.value) || 0)}
                                        className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                                        min="0"
                                    />
                                </div>
                            </div>

                            {/* Discord Role ID */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">Discord Role ID</label>
                                <RoleCombobox
                                    serverId={serverId}
                                    value={formDiscordRoleId}
                                    onChange={(val) => setFormDiscordRoleId(val || "")}
                                    placeholder="Select a Discord role to link..."
                                />
                                <p className="text-xs text-zinc-600 mt-1">
                                    Users with this Discord role will auto-receive this panel role
                                </p>
                            </div>

                            {/* Permissions */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">Permissions</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {Object.entries(PERMISSION_DETAILS).map(([key, details]) => (
                                        <label key={key} className="flex items-center justify-between p-3 rounded-lg bg-[#222] hover:bg-[#2a2a2a] cursor-pointer group">
                                            <div>
                                                <span className="text-sm text-zinc-300 font-medium block">{details.label}</span>
                                                <span className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">{details.description}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setFormPerms(prev => ({ ...prev, [key]: !prev[key as keyof RolePermissions] }))}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${formPerms[key as keyof RolePermissions] ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formPerms[key as keyof RolePermissions] ? 'translate-x-6' : 'translate-x-1'}`}
                                                />
                                            </button>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-[#222] flex justify-end gap-2">
                            <button
                                onClick={() => setCreating(false)}
                                className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!formName.trim()}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors disabled:opacity-50"
                            >
                                <Check className="h-4 w-4" />
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
