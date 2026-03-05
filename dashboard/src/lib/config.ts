
import { prisma } from "./db"

/**
 * Global and Per-Server Configuration Helper
 * Handles fetching dynamic config from DB with hardcoded fallbacks.
 */

// --- GLOBAL DEFAULTS (Superadmin) ---
const GLOBAL_DEFAULTS = {
    MAX_REQUESTS_PER_MINUTE: 200,
    BAN_REASON: "Automated anti-scraping: excessive requests per minute.",
    SYNC_INTERVAL_MS: 10000,
    QUEUE_INTERVAL_MS: 3000,
    SYSTEM_ACTOR: "pow-system",
    MAX_DB_BUFFER_SIZE: 1000,
    PRC_BASE_URL: "https://api.policeroleplay.community/v1",
    ROBLOX_OPEN_CLOUD_BASE: "https://apis.roblox.com/cloud/v2",
}

export type GlobalConfigKey = keyof typeof GLOBAL_DEFAULTS

// In-memory cache for global config (1 min)
const globalCache = new Map<string, { value: any, expires: number }>()

export async function getGlobalConfig<T extends GlobalConfigKey>(key: T, defaultValue?: any): Promise<typeof GLOBAL_DEFAULTS[T]> {
    const now = Date.now()
    if (globalCache.has(key)) {
        const cached = globalCache.get(key)!
        if (cached.expires > now) return cached.value
    }

    const dbConfig = await prisma.config.findUnique({ where: { key } })
    let value: any = dbConfig ? null : (defaultValue ?? GLOBAL_DEFAULTS[key])

    if (dbConfig) {
        try {
            value = JSON.parse(dbConfig.value)
        } catch {
            value = dbConfig.value
        }
    } else {
        value = defaultValue ?? GLOBAL_DEFAULTS[key]
    }

    globalCache.set(key, { value, expires: now + 60000 })
    return value
}

// --- PER-SERVER CONFIGS ---
const SERVER_DEFAULTS = {
    maxUploadSize: 50 * 1024 * 1024, // 50MB
    staffRequestRateLimit: 5 * 60 * 1000, // 5 mins
    logCacheTtl: 5000, // 5 secs
    automationCacheTtl: 10000, // 10 secs
}

export type ServerConfigKey = keyof typeof SERVER_DEFAULTS

export async function getServerOverride<T extends ServerConfigKey>(serverId: string, key: T): Promise<typeof SERVER_DEFAULTS[T]> {
    // These keys were removed from the database model, so always return default
    if (key === "logCacheTtl" || key === "automationCacheTtl") {
        return SERVER_DEFAULTS[key]
    }

    const server = await prisma.server.findUnique({
        where: { id: serverId },
        select: { [key]: true }
    })

    const value = (server as any)?.[key]
    return value !== null && value !== undefined ? value : SERVER_DEFAULTS[key]
}
