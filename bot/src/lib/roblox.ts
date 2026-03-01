/**
 * Cached Roblox API utilities for the bot
 * Uses aggressive in-memory caching to avoid rate limits
 */

interface CachedData<T> {
    data: T
    timestamp: number
}

const cache = new Map<string, CachedData<any>>()
const FRESH_TTL = 1000 * 60 * 60 * 24 // 24 hours
const STALE_TTL = 1000 * 60 * 60 * 48 // 48 hours (fallback)

function getFromCache<T>(key: string): T | null {
    const cached = cache.get(key)
    if (!cached) return null
    if (Date.now() - cached.timestamp > FRESH_TTL) return null
    return cached.data
}

function getFromCacheStale<T>(key: string): T | null {
    const cached = cache.get(key)
    if (!cached) return null
    if (Date.now() - cached.timestamp > STALE_TTL) {
        cache.delete(key)
        return null
    }
    return cached.data
}

function setToCache<T>(key: string, data: T): void {
    cache.set(key, { data, timestamp: Date.now() })
}

/**
 * Get Roblox user ID from username with aggressive caching
 */
export async function getRobloxId(username: string): Promise<string | null> {
    const cacheKey = `roblox:search:${username.toLowerCase()}`

    // Check fresh cache
    const cached = getFromCache<string>(cacheKey)
    if (cached) return cached

    try {
        const res = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`)

        // Handle rate limit - return stale cache
        if (res.status === 429) {
            console.warn(`[ROBLOX] Rate limited for ${username}, using stale cache`)
            return getFromCacheStale<string>(cacheKey)
        }

        if (!res.ok) {
            return getFromCacheStale<string>(cacheKey)
        }

        const data = await res.json()
        if (data.data && data.data.length > 0) {
            // Find exact match or use first result
            const exact = data.data.find((u: any) => u.name.toLowerCase() === username.toLowerCase())
            const userId = exact ? exact.id.toString() : data.data[0].id.toString()

            // Cache by both username searched and exact username
            setToCache(cacheKey, userId)
            if (exact) {
                setToCache(`roblox:search:${exact.name.toLowerCase()}`, userId)
            }

            return userId
        }
        return null
    } catch (e) {
        console.error(`[ROBLOX] Error fetching user ${username}:`, e)
        // Return stale cache on error
        return getFromCacheStale<string>(cacheKey)
    }
}

/**
 * Get Roblox username from user ID with caching
 */
export async function getRobloxUsername(userId: string): Promise<string | null> {
    const cacheKey = `roblox:user:${userId}`

    const cached = getFromCache<string>(cacheKey)
    if (cached) return cached

    try {
        const res = await fetch(`https://users.roblox.com/v1/users/${userId}`)

        if (res.status === 429) {
            console.warn(`[ROBLOX] Rate limited for ID ${userId}, using stale cache`)
            return getFromCacheStale<string>(cacheKey)
        }

        if (!res.ok) {
            return getFromCacheStale<string>(cacheKey)
        }

        const data = await res.json()
        if (data.name) {
            setToCache(cacheKey, data.name)
            // Also cache the reverse lookup
            setToCache(`roblox:search:${data.name.toLowerCase()}`, userId)
            return data.name
        }
        return null
    } catch (e) {
        console.error(`[ROBLOX] Error fetching user by ID ${userId}:`, e)
        return getFromCacheStale<string>(cacheKey)
    }
}
