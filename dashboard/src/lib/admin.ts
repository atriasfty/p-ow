import { prisma } from "@/lib/db"

// The superadmin ID - only this user can grant admin access
const SUPER_ADMIN_ID = "user_36ogKIU3qHTwhGT3mrVtvUrTgbW"

export interface SessionUser {
    id: string
    username?: string | null
    name?: string | null
    discordId?: string
    robloxId?: string
    robloxUsername?: string | null
}

// New permission structure matching schema
export interface RolePermissions {
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
}

// Default permissions (viewer/staff access)
export const DEFAULT_PERMISSIONS: RolePermissions = {
    canShift: true,
    canViewOtherShifts: false,
    canViewLogs: true,
    canViewPunishments: true,
    canIssueWarnings: false,
    canKick: false,
    canBan: false,
    canBanBolo: false,
    canUseToolbox: true,
    canManageBolos: false,
    canRequestLoa: true,
    canViewQuota: true,
    canUseAdminCommands: false
}

// All permissions (for superadmin and server admins)
export const ALL_PERMISSIONS: RolePermissions = {
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
    canUseAdminCommands: true
}

/**
 * Check if the user is the superadmin (can grant admin access to others)
 */
export function isSuperAdmin(user: SessionUser | null): boolean {
    if (!user) return false
    return user.id === SUPER_ADMIN_ID
}

/**
 * Check if the user is the owner (subscriber) of a server
 */
export async function isServerOwner(user: SessionUser | null, serverId: string): Promise<boolean> {
    if (!user) return false
    if (isSuperAdmin(user)) return true

    const server = await prisma.server.findUnique({
        where: { id: serverId },
        select: { subscriberUserId: true }
    })

    return server?.subscriberUserId === user.id
}

/**
 * Check if the user is an admin for a specific server
 */
export async function isServerAdmin(user: SessionUser | null, serverId: string): Promise<boolean> {
    if (!user) return false

    // Superadmin always has access
    if (isSuperAdmin(user)) return true

    // Server owner always has access
    if (await isServerOwner(user, serverId)) return true

    // Build possible user IDs to check (member might be stored with any of these)
    const possibleIds = [user.id]
    if (user.discordId) possibleIds.push(user.discordId)
    if (user.robloxId) possibleIds.push(user.robloxId)

    // Check if any of the user's possible IDs are marked as admin in the Member table
    const member = await prisma.member.findFirst({
        where: {
            serverId,
            userId: { in: possibleIds },
            isAdmin: true
        }
    })

    return member !== null
}

/**
 * Check if the user is a member of a specific server (tenant isolation)
 */
export async function isServerMember(user: SessionUser | null, serverId: string): Promise<boolean> {
    if (!user) return false

    // Superadmin has access to everything
    if (isSuperAdmin(user)) return true

    const possibleIds = [user.id]
    if (user.discordId) possibleIds.push(user.discordId)
    if (user.robloxId) possibleIds.push(user.robloxId)

    const member = await prisma.member.findFirst({
        where: {
            serverId,
            userId: { in: possibleIds }
        }
    })

    return member !== null
}

/**
 * Get the user's role and permissions for a server
 */
export async function getUserPermissions(user: SessionUser | null, serverId: string): Promise<RolePermissions> {
    if (!user) return DEFAULT_PERMISSIONS

    // Superadmin has all permissions
    if (isSuperAdmin(user)) return ALL_PERMISSIONS

    // Build possible user IDs to check (member might be stored with any of these)
    const possibleIds = [user.id]
    if (user.discordId) possibleIds.push(user.discordId)
    if (user.robloxId) possibleIds.push(user.robloxId)

    const member = await prisma.member.findFirst({
        where: {
            serverId,
            userId: { in: possibleIds }
        },
        include: { role: true }
    })

    if (!member) return DEFAULT_PERMISSIONS

    // If member is marked as Admin in DB, they get everything
    if (member.isAdmin) return ALL_PERMISSIONS

    if (!member.role) return DEFAULT_PERMISSIONS

    // Return permissions directly from role
    return {
        canShift: member.role.canShift,
        canViewOtherShifts: member.role.canViewOtherShifts,
        canViewLogs: member.role.canViewLogs,
        canViewPunishments: member.role.canViewPunishments,
        canIssueWarnings: member.role.canIssueWarnings,
        canKick: member.role.canKick,
        canBan: member.role.canBan,
        canBanBolo: member.role.canBanBolo,
        canUseToolbox: member.role.canUseToolbox,
        canManageBolos: member.role.canManageBolos,
        canRequestLoa: member.role.canRequestLoa,
        canViewQuota: member.role.canViewQuota,
        canUseAdminCommands: member.role.canUseAdminCommands
    }
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(
    user: SessionUser | null,
    serverId: string,
    permission: keyof RolePermissions
): Promise<boolean> {
    const perms = await getUserPermissions(user, serverId)
    return perms[permission]
}

/**
 * Check if user is currently on an approved leave of absence
 */
export async function isOnLeave(userId: string, serverId: string): Promise<boolean> {
    const now = new Date()

    const activeLoa = await prisma.leaveOfAbsence.findFirst({
        where: {
            userId,
            serverId,
            status: "approved",
            startDate: { lte: now },
            endDate: { gte: now }
        }
    })

    return activeLoa !== null
}

/**
 * Get user's active LOA if any
 */
export async function getActiveLeave(userId: string, serverId: string) {
    const now = new Date()

    return await prisma.leaveOfAbsence.findFirst({
        where: {
            userId,
            serverId,
            status: "approved",
            startDate: { lte: now },
            endDate: { gte: now }
        }
    })
}
