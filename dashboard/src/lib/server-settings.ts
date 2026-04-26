import { prisma } from "./db"
import { getServerPlan, ServerPlan } from "./subscription"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ServerSettings {
    // SHIFT & DUTY
    shiftMinDurationSeconds: number       // 0 = no minimum
    shiftMaxDurationHours: number         // 0 = no maximum / no auto-end
    shiftCooldownMinutes: number          // 0 = no cooldown between shifts
    shiftMaxOnDuty: number                // 0 = unlimited concurrent
    shiftEndOnShutdown: boolean
    shiftRequirePlayersInGame: boolean
    shiftLoaBlocks: boolean               // LOA blocks shift start
    shiftPmBranding: string               // e.g. '[POW]'
    shiftPmStatusFormat: 'percent' | 'time' | 'remaining'

    // QUOTA
    quotaWeekStartDay: number             // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    quotaTimezone: string                 // IANA timezone string
    quotaGracePeriodMinutes: number       // 0 = no grace period
    quotaMinCountSeconds: number          // 0 = all shifts count
    quotaPeriodType: 'weekly' | 'monthly'

    // IN-GAME :log COMMANDS
    inGameCommandPrefix: string           // e.g. ':log'
    inGameShiftEnabled: boolean
    inGameWarnEnabled: boolean
    inGameKickEnabled: boolean
    inGameBanEnabled: boolean
    inGameBoloEnabled: boolean
    inGameTargetLookbackMinutes: number   // How far back to look for players who left
    inGameRobloxFallbackEnabled: boolean  // Fall back to Roblox username lookup
    shutdownCommandPatterns: string[]     // Commands that trigger shutdown handling

    // RAID DETECTION
    raidSensitiveCommands: string[]
    raidHighFreqThreshold: number         // Commands in window to trigger alert
    raidHighFreqWindowSeconds: number
    raidMassActionPatterns: string[]      // Substrings that indicate mass actions
    raidAlertEmbedColor: number
    raidAlertEmbedTitle: string

    // MILESTONES
    milestonePeriodType: 'weekly' | 'monthly' | 'lifetime'
    milestoneDebounceHours: number        // Hours between duplicate milestone notifications
    milestoneRolesPermanent: boolean      // Keep milestone roles even if no longer qualified
    milestoneEmbedColor: number
    milestoneEmbedTitle: string

    // LEAVE OF ABSENCE
    loaEmbedColor: number
    loaMaxDurationDays: number            // 0 = unlimited
    loaMinNoticeDays: number              // 0 = no minimum notice
    loaMaxPendingPerMember: number        // 0 = unlimited
    loaFallbackToStaffChannel: boolean    // Fall back to staffRequestChannelId if no loaChannelId

    // DISCORD JIT VERIFICATION
    jitVerifyIntervalMinutes: number

    // PLAYER MAP & TRACKING
    mapShowAllTeams: boolean              // false = only show staff teams
    vehicleTrackingEnabled: boolean

    // PUNISHMENT
    punishmentTypes: string[]
    banEnforceInGame: boolean             // Execute PRC :ban when logging a Ban
    punishmentWarnAutoResolveDays: number // 0 = never auto-resolve
    punishmentNotifyOnCreate: boolean     // Discord notification to permLogChannelId

    // SSE SNAPSHOT WINDOWS
    ssePlayerWindowMinutes: number
    sseModCallSnapshotLimit: number
    sseEmergencySnapshotLimit: number
    modCallDedupeWindowMinutes: number

    // FORMS
    formDefaultAllowMultiple: boolean
    formMinRobloxAccountAgeDays: number   // 0 = no minimum account age
    formExpiryNotification: boolean

    // NOTIFICATIONS & BRANDING
    staffRequestEmbedColor: number
    staffRequestPmBranding: string
    loaApprovalDmNotify: boolean
    ssdDisplayDays: number

    // AUTOMATION
    announcementCommandPrefix: string
    timeIntervalDefaultMinutes: number

    // DATA RETENTION (plan-clamped)
    dataRetentionDays: number
}

// ─── Plan-tiered retention defaults ──────────────────────────────────────────

export const PLAN_RETENTION_DEFAULTS: Record<ServerPlan, number> = {
    'free': 30,
    'pow-pro': 180,
    'pow-max': 1095
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: Omit<ServerSettings, 'dataRetentionDays'> = {
    // SHIFT & DUTY
    shiftMinDurationSeconds: 0,
    shiftMaxDurationHours: 0,
    shiftCooldownMinutes: 0,
    shiftMaxOnDuty: 0,
    shiftEndOnShutdown: true,
    shiftRequirePlayersInGame: true,
    shiftLoaBlocks: false,
    shiftPmBranding: '[POW]',
    shiftPmStatusFormat: 'percent',

    // QUOTA
    quotaWeekStartDay: 1,
    quotaTimezone: 'UTC',
    quotaGracePeriodMinutes: 0,
    quotaMinCountSeconds: 0,
    quotaPeriodType: 'weekly',

    // IN-GAME :log COMMANDS
    inGameCommandPrefix: ':log',
    inGameShiftEnabled: true,
    inGameWarnEnabled: true,
    inGameKickEnabled: true,
    inGameBanEnabled: true,
    inGameBoloEnabled: true,
    inGameTargetLookbackMinutes: 30,
    inGameRobloxFallbackEnabled: true,
    shutdownCommandPatterns: [':shutdown'],

    // RAID DETECTION
    raidSensitiveCommands: [':ban', ':kick', ':kill', ':unadmin', ':unmod', ':down', ':pban'],
    raidHighFreqThreshold: 5,
    raidHighFreqWindowSeconds: 10,
    raidMassActionPatterns: ['all', 'others', 'random'],
    raidAlertEmbedColor: 0xFF0000,
    raidAlertEmbedTitle: '⚠️ RAID DETECTION ALERT',

    // MILESTONES
    milestonePeriodType: 'weekly',
    milestoneDebounceHours: 24,
    milestoneRolesPermanent: true,
    milestoneEmbedColor: 0x10b981,
    milestoneEmbedTitle: '🏆 Weekly Milestone Reached',

    // LEAVE OF ABSENCE
    loaEmbedColor: 0x6366f1,
    loaMaxDurationDays: 0,
    loaMinNoticeDays: 0,
    loaMaxPendingPerMember: 0,
    loaFallbackToStaffChannel: true,

    // DISCORD JIT VERIFICATION
    jitVerifyIntervalMinutes: 5,

    // PLAYER MAP & TRACKING
    mapShowAllTeams: true,
    vehicleTrackingEnabled: true,

    // PUNISHMENT
    punishmentTypes: ['Warn', 'Kick', 'Ban', 'Ban Bolo'],
    banEnforceInGame: false,
    punishmentWarnAutoResolveDays: 0,
    punishmentNotifyOnCreate: false,

    // SSE SNAPSHOT WINDOWS
    ssePlayerWindowMinutes: 2,
    sseModCallSnapshotLimit: 50,
    sseEmergencySnapshotLimit: 50,
    modCallDedupeWindowMinutes: 60,

    // FORMS
    formDefaultAllowMultiple: true,
    formMinRobloxAccountAgeDays: 0,
    formExpiryNotification: false,

    // NOTIFICATIONS & BRANDING
    staffRequestEmbedColor: 0xFFA500,
    staffRequestPmBranding: 'Project Overwatch',
    loaApprovalDmNotify: false,
    ssdDisplayDays: 7,

    // AUTOMATION
    announcementCommandPrefix: ':m',
    timeIntervalDefaultMinutes: 60
}

// ─── In-memory cache (60 second TTL) ─────────────────────────────────────────

interface CacheEntry {
    settings: ServerSettings
    expiresAt: number
}

const globalForSettings = globalThis as unknown as {
    serverSettingsCache: Map<string, CacheEntry> | undefined
}

const settingsCache = globalForSettings.serverSettingsCache ??= new Map<string, CacheEntry>()

const CACHE_TTL_MS = 60_000

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Get the merged ServerSettings for a server.
 * Reads from DB, merges with defaults, caches for 60 seconds.
 * The dataRetentionDays default is plan-aware and the stored value is clamped to the plan ceiling.
 */
export async function getServerSettings(serverId: string): Promise<ServerSettings> {
    const now = Date.now()
    const cached = settingsCache.get(serverId)
    if (cached && cached.expiresAt > now) return cached.settings

    // Fetch server settings and plan in parallel
    const [server, planInfo] = await Promise.all([
        prisma.server.findUnique({
            where: { id: serverId },
            select: { settings: true, subscriptionPlan: true }
        }),
        getServerPlan(serverId)
    ])

    const plan = planInfo.plan
    const planRetentionDefault = PLAN_RETENTION_DEFAULTS[plan]

    // Parse stored JSON (may be null or invalid JSON)
    let stored: Partial<ServerSettings> = {}
    if (server?.settings) {
        try {
            stored = JSON.parse(server.settings)
        } catch {
            // Ignore malformed JSON, use defaults
        }
    }

    // Clamp dataRetentionDays: server may only set LOWER than plan default, never higher
    const storedRetention = typeof stored.dataRetentionDays === 'number' ? stored.dataRetentionDays : planRetentionDefault
    const dataRetentionDays = Math.min(storedRetention, planRetentionDefault)

    const settings: ServerSettings = {
        ...DEFAULT_SETTINGS,
        ...stored,
        dataRetentionDays
    }

    settingsCache.set(serverId, { settings, expiresAt: now + CACHE_TTL_MS })
    return settings
}

/**
 * Invalidate the cached settings for a server (call after admin saves settings).
 */
export function invalidateSettingsCache(serverId: string): void {
    settingsCache.delete(serverId)
}

/**
 * Save partial settings for a server.
 * Merges with existing stored settings, clamps dataRetentionDays to plan ceiling,
 * and invalidates the cache.
 */
export async function saveServerSettings(
    serverId: string,
    partial: Partial<ServerSettings>
): Promise<ServerSettings> {
    const [server, planInfo] = await Promise.all([
        prisma.server.findUnique({
            where: { id: serverId },
            select: { settings: true }
        }),
        getServerPlan(serverId)
    ])

    const plan = planInfo.plan
    const planCeiling = PLAN_RETENTION_DEFAULTS[plan]

    let existing: Partial<ServerSettings> = {}
    if (server?.settings) {
        try {
            existing = JSON.parse(server.settings)
        } catch { /* ignore */ }
    }

    const merged: Partial<ServerSettings> = { ...existing, ...partial }

    // Clamp retention days
    if (typeof merged.dataRetentionDays === 'number') {
        merged.dataRetentionDays = Math.min(merged.dataRetentionDays, planCeiling)
    }

    await prisma.server.update({
        where: { id: serverId },
        data: { settings: JSON.stringify(merged) }
    })

    invalidateSettingsCache(serverId)
    return getServerSettings(serverId)
}
