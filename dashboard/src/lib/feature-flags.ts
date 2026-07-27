import { cache } from 'react'
import { prisma } from '@/lib/db'

/**
 * SaaS Feature Flags for subscription-based gating
 * Replacing PostHog flags with native Prisma database checks.
 */

export const FEATURE_FLAGS = {
    // Global switches
    SUBSCRIPTIONS_ENABLED: 'subscriptions-enabled',
    SERVER_CREATION: 'server-creation',
    PRICING_PAGE: 'pricing-page',
    ROTECTOR_INTEGRATION: 'rotector-integration',

    // Server-level feature capabilities
    FORMS_LIMIT_CHECK: 'forms-limit-check',           // "free" has limit, pro/max skip limits
    AUTOMATIONS_LIMIT_CHECK: 'automations-limit-check', // "free" has limit, pro/max skip limits
    RAID_DETECTION: 'raid-detection',                 // Requires pow-pro or pow-max
    RAID_AUTO_ACTIONS: 'raid-auto-actions',           // Requires pow-max
    EXPORTS: 'exports',                               // Requires pow-pro or pow-max
    WHITE_LABEL_BOT: 'white-label-bot',               // Requires pow-max

    // User-level features
    VISION_ACCESS: 'vision-access',
    CUSTOM_THEMES: 'custom-themes',
    PERSONAL_NOTES: 'personal-notes',
    EXTENDED_HISTORY: 'extended-history',
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS

/**
 * Universal global configuration variables stored in `Config`
 */
export const getGlobalConfig = cache(async (key: string, defaultValue: boolean): Promise<boolean> => {
    try {
        const config = await prisma.config.findUnique({ where: { key } })
        if (config) return config.value === 'true'
        return defaultValue
    } catch {
        return defaultValue
    }
})

/**
 * Assesses whether a specific Server is permitted to use a feature based on `subscriptionPlan`.
 */
export const isServerFeatureEnabled = cache(async (
    flag: FeatureFlag,
    serverId: string
): Promise<boolean> => {
    try {
        const server = await prisma.server.findUnique({
            where: { id: serverId },
            select: { subscriptionPlan: true }
        })
        const plan = server?.subscriptionPlan || 'free'

        switch (flag) {
            case 'FORMS_LIMIT_CHECK':
            case 'AUTOMATIONS_LIMIT_CHECK':
                // Free plan HAS limits. Returns true if limited.
                return plan === 'free'

            case 'RAID_DETECTION':
            case 'EXPORTS':
            case 'CUSTOM_THEMES':
                // Requires Pro or Max
                return plan === 'pow-pro' || plan === 'pow-max'

            case 'RAID_AUTO_ACTIONS':
            case 'WHITE_LABEL_BOT':
            case 'VISION_ACCESS':
            case 'EXTENDED_HISTORY':
            case 'PERSONAL_NOTES':
                // Requires Max
                return plan === 'pow-max'

            default:
                return true
        }
    } catch (e) {
        // Fail-safe: if we can't check the plan, assume limits are active to prevent abuse
        if (flag === 'FORMS_LIMIT_CHECK' || flag === 'AUTOMATIONS_LIMIT_CHECK') {
            return true
        }
        return false
    }
})

/** 
 * Check if a global toggle is enabled. Backwards compatibility for landing page UI 
 */
export const isFeatureEnabled = cache(async (flag: FeatureFlag): Promise<boolean> => {
    if (flag === 'SUBSCRIPTIONS_ENABLED' || flag === 'SERVER_CREATION' || flag === 'PRICING_PAGE') {
        const defaultValue = flag === 'PRICING_PAGE' ? true : true // Default all to true
        return await getGlobalConfig(flag, defaultValue)
    }
    // Rotector must stay off until its DPIA has been reviewed — default false,
    // not true like the other global toggles above.
    if (flag === 'ROTECTOR_INTEGRATION') {
        return await getGlobalConfig(flag, false)
    }
    return true
})

export async function isSubscriptionsEnabled(): Promise<boolean> {
    return isFeatureEnabled('SUBSCRIPTIONS_ENABLED')
}

/** Legacy UI compat stub */
export const getSubscriptionFlags = cache(async (): Promise<Record<string, boolean>> => {
    return Object.fromEntries(Object.keys(FEATURE_FLAGS).map(key => [key, true]))
})
