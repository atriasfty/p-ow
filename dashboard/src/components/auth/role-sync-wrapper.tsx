"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ShieldOff, Eye } from "lucide-react"

// Permission structure
interface Permissions {
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

// Default permissions (all false)
const DEFAULT_PERMISSIONS: Permissions = {
    canShift: false,
    canViewOtherShifts: false,
    canViewLogs: false,
    canViewPunishments: false,
    canIssueWarnings: false,
    canKick: false,
    canBan: false,
    canBanBolo: false,
    canUseToolbox: false,
    canManageBolos: false,
    canRequestLoa: false,
    canViewQuota: false,
    canUseAdminCommands: false,
    canAccessAdmin: false
}

// Context for permissions and quota
const PermissionsContext = createContext<{ permissions: Permissions; viewerOnly: boolean; quotaMinutes: number }>({
    permissions: DEFAULT_PERMISSIONS,
    viewerOnly: false,
    quotaMinutes: 0
})

export function usePermissions() {
    return useContext(PermissionsContext)
}

interface RoleSyncWrapperProps {
    serverId: string
    children: ReactNode
}

// Permission cache - store results for 5 minutes
interface CachedPermission {
    status: "ok" | "suspended" | "terminated" | "noAccess"
    permissions: Permissions
    viewerOnly: boolean
    quotaMinutes: number
    timestamp: number
}
const permissionCache = new Map<string, CachedPermission>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function RoleSyncWrapper({ serverId, children }: RoleSyncWrapperProps) {
    const [status, setStatus] = useState<"loading" | "ok" | "suspended" | "terminated" | "noAccess" | "error">("loading")
    const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS)
    const [viewerOnly, setViewerOnly] = useState(false)
    const [quotaMinutes, setQuotaMinutes] = useState(0)
    const router = useRouter()

    useEffect(() => {
        async function syncRole() {
            // Check cache first
            const cached = permissionCache.get(serverId)
            if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
                setPermissions(cached.permissions)
                setViewerOnly(cached.viewerOnly)
                setQuotaMinutes(cached.quotaMinutes)
                setStatus(cached.status)
                if (cached.status === "terminated") {
                    setTimeout(() => router.push("/login"), 2000)
                }
                return
            }

            try {
                const res = await fetch("/api/discord/auto-assign", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-csrf-check": "1"
                    },
                    body: JSON.stringify({ serverId })
                })

                if (!res.ok) {
                    setStatus("noAccess")
                    return
                }

                const data = await res.json()

                if (data.error) {
                    setStatus("noAccess")
                    return
                }

                if (data.terminated) {
                    setStatus("terminated")
                    permissionCache.set(serverId, {
                        status: "terminated",
                        permissions: DEFAULT_PERMISSIONS,
                        viewerOnly: false,
                        quotaMinutes: 0,
                        timestamp: Date.now()
                    })
                    setTimeout(() => router.push("/login"), 2000)
                    return
                }

                if (data.suspended) {
                    setStatus("suspended")
                    return
                }

                if (data.noAccess) {
                    setStatus("noAccess")
                    return
                }

                // Success - set permissions and quota
                const perms = data.permissions || {}
                const finalPermissions = {
                    canShift: perms.canShift ?? false,
                    canViewOtherShifts: perms.canViewOtherShifts ?? false,
                    canViewLogs: perms.canViewLogs ?? false,
                    canViewPunishments: perms.canViewPunishments ?? false,
                    canIssueWarnings: perms.canIssueWarnings ?? false,
                    canKick: perms.canKick ?? false,
                    canBan: perms.canBan ?? false,
                    canBanBolo: perms.canBanBolo ?? false,
                    canUseToolbox: perms.canUseToolbox ?? false,
                    canManageBolos: perms.canManageBolos ?? false,
                    canRequestLoa: perms.canRequestLoa ?? false,
                    canViewQuota: perms.canViewQuota ?? false,
                    canUseAdminCommands: perms.canUseAdminCommands ?? false,
                    canAccessAdmin: perms.canAccessAdmin ?? false
                }
                setPermissions(finalPermissions)
                setViewerOnly(data.viewerOnly || false)
                setQuotaMinutes(data.quotaMinutes || 0)
                setStatus("ok")

                // Cache the result
                permissionCache.set(serverId, {
                    status: "ok",
                    permissions: finalPermissions,
                    viewerOnly: data.viewerOnly || false,
                    quotaMinutes: data.quotaMinutes || 0,
                    timestamp: Date.now()
                })

            } catch (e) {
                // On error, block access (fail closed for security)
                setStatus("noAccess")
            }
        }

        syncRole()
    }, [serverId, router])

    // Render children immediately but hidden during loading (allows parallel data fetching)
    // Show loading overlay on top
    if (status === "loading") {
        return (
            <PermissionsContext.Provider value={{ permissions, viewerOnly, quotaMinutes }}>
                {/* Hidden children - still render so they can start fetching */}
                <div style={{ visibility: "hidden", position: "absolute", pointerEvents: "none" }}>
                    {children}
                </div>
                {/* Loading overlay */}
                <div className="min-h-screen bg-[#111] flex items-center justify-center">
                    <div className="text-center space-y-4">
                        <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-zinc-400 text-sm">Checking access...</p>
                    </div>
                </div>
            </PermissionsContext.Provider>
        )
    }

    // Terminated state
    if (status === "terminated") {
        return (
            <div className="min-h-screen bg-[#111] flex items-center justify-center">
                <div className="text-center space-y-4 max-w-md p-8">
                    <div className="h-16 w-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                        <ShieldOff className="h-8 w-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-red-500">Account Terminated</h1>
                    <p className="text-zinc-400">Your account has been permanently terminated.</p>
                    <p className="text-zinc-500 text-sm">Redirecting to login...</p>
                </div>
            </div>
        )
    }

    // Suspended state
    if (status === "suspended") {
        return (
            <div className="min-h-screen bg-[#111] flex items-center justify-center">
                <div className="text-center space-y-4 max-w-md p-8">
                    <div className="h-16 w-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto">
                        <ShieldOff className="h-8 w-8 text-orange-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-orange-500">Account Suspended</h1>
                    <p className="text-zinc-400">Your account has been suspended from accessing this panel.</p>
                    <a href="/dashboard" className="inline-block mt-4 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors">
                        Return to Dashboard
                    </a>
                </div>
            </div>
        )
    }

    // No Access state
    if (status === "noAccess") {
        return (
            <div className="min-h-screen bg-[#111] flex items-center justify-center">
                <div className="text-center space-y-4 max-w-md p-8">
                    <div className="h-16 w-16 bg-zinc-700/50 rounded-full flex items-center justify-center mx-auto">
                        <ShieldOff className="h-8 w-8 text-zinc-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-400">Access Denied</h1>
                    <p className="text-zinc-500">You don't have the required Discord role to access this panel.</p>
                    <a href="/dashboard" className="inline-block mt-4 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors">
                        Return to Dashboard
                    </a>
                </div>
            </div>
        )
    }

    // OK state - render children with permissions context
    return (
        <PermissionsContext.Provider value={{ permissions, viewerOnly, quotaMinutes }}>
            {viewerOnly && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/10 border-b border-amber-500/30 px-4 py-2">
                    <div className="flex items-center justify-center gap-2 text-amber-400 text-sm">
                        <Eye className="h-4 w-4" />
                        <span>Viewer Mode - You can view but not take actions</span>
                    </div>
                </div>
            )}
            <div className={viewerOnly ? "pt-10" : ""}>
                {children}
            </div>
        </PermissionsContext.Provider>
    )
}

