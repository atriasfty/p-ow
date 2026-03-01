
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const GLOBAL_DEFAULTS = {
    SYNC_INTERVAL_MS: 10000,
    QUEUE_INTERVAL_MS: 3000,
    ROLE_SYNC_INTERVAL_MS: 10000,
}

export type GlobalConfigKey = keyof typeof GLOBAL_DEFAULTS

export async function getGlobalConfig<T extends GlobalConfigKey>(key: T): Promise<number> {
    try {
        const dbConfig = await prisma.config.findUnique({ where: { key } })
        if (dbConfig) {
            const val = parseInt(dbConfig.value)
            if (!isNaN(val)) return val
        }
    } catch (e) {
        console.error(`[CONFIG] Error fetching global config for key ${key}:`, e)
    }
    return GLOBAL_DEFAULTS[key]
}
