import { prisma } from "../client"

/**
 * Minimal subset of ServerSettings the bot needs.
 * Mirrors the dashboard's server-settings.ts defaults for these fields only.
 */
export interface BotServerSettings {
    shiftMaxOnDuty: number          // 0 = unlimited
    shiftCooldownMinutes: number    // 0 = no cooldown
    shiftLoaBlocks: boolean         // LOA blocks shift start
    shiftRequirePlayersInGame: boolean
    shiftPmBranding: string
    milestoneDebounceHours: number
    milestonePeriodType: 'weekly' | 'monthly' | 'lifetime'
    milestoneEmbedColor: number
    milestoneEmbedTitle: string
    quotaWeekStartDay: number       // 0 = Sunday, 1 = Monday
    quotaTimezone: string
    loaMaxDurationDays: number      // 0 = unlimited
    loaMinNoticeDays: number        // 0 = no minimum notice
    loaMaxPendingPerMember: number  // 0 = unlimited
}

const BOT_DEFAULTS: BotServerSettings = {
    shiftMaxOnDuty: 0,
    shiftCooldownMinutes: 0,
    shiftLoaBlocks: false,
    shiftRequirePlayersInGame: true,
    shiftPmBranding: '[POW]',
    milestoneDebounceHours: 24,
    milestonePeriodType: 'weekly',
    milestoneEmbedColor: 0x10b981,
    milestoneEmbedTitle: '🏆 Weekly Milestone Reached',
    quotaWeekStartDay: 1,
    quotaTimezone: 'UTC',
    loaMaxDurationDays: 0,
    loaMinNoticeDays: 0,
    loaMaxPendingPerMember: 0
}

// 60-second in-memory cache
const cache = new Map<string, { settings: BotServerSettings; expiresAt: number }>()
const CACHE_TTL_MS = 60_000

export async function getBotServerSettings(serverId: string): Promise<BotServerSettings> {
    const now = Date.now()
    const cached = cache.get(serverId)
    if (cached && cached.expiresAt > now) return cached.settings

    const server = await prisma.server.findUnique({
        where: { id: serverId },
        select: { settings: true }
    })

    let stored: Partial<BotServerSettings> = {}
    if (server?.settings) {
        try {
            stored = JSON.parse(server.settings)
        } catch { /* ignore malformed JSON */ }
    }

    const settings: BotServerSettings = { ...BOT_DEFAULTS, ...stored }
    cache.set(serverId, { settings, expiresAt: now + CACHE_TTL_MS })
    return settings
}

export function invalidateBotSettingsCache(serverId: string): void {
    cache.delete(serverId)
}
