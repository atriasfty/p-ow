/**
 * Timezone-aware week/period boundary helpers.
 *
 * Quota and shift calculations need to align week boundaries to the server's
 * configured timezone, not the host process's local time. Three call sites
 * (dashboard /api/admin/shifts, log-syncer shift status PM, bot /quota & /shift)
 * historically reimplemented this — sometimes correctly, sometimes using
 * `now.setHours(0,0,0,0)` which silently drifts on a UTC VPS for any server
 * configured outside UTC. This module is the single source of truth.
 */

export function getMidnightInTimezone(
    year: number,
    month: number,
    day: number,
    timezone: string
): Date {
    const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
    })
    const parts = fmt.formatToParts(noonUTC)
    let h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '12')
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
    const s = parseInt(parts.find(p => p.type === 'second')?.value ?? '0')
    if (h === 24) h = 0
    const localDay = parseInt(parts.find(p => p.type === 'day')?.value ?? String(day))
    const localMonth = parseInt(parts.find(p => p.type === 'month')?.value ?? String(month))
    const localYear = parseInt(parts.find(p => p.type === 'year')?.value ?? String(year))
    const dayDiffMs = Date.UTC(localYear, localMonth - 1, localDay) - Date.UTC(year, month - 1, day)
    return new Date(noonUTC.getTime() - (h * 3600 + m * 60 + s) * 1000 - dayDiffMs)
}

/**
 * Returns the start (midnight in `timezone`) of the current quota week.
 * `weekStartDay` is 0=Sunday … 6=Saturday.
 */
export function getWeekStart(weekStartDay: number, timezone: string): Date {
    const now = new Date()
    try {
        const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'short',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        })
        const parts = fmt.formatToParts(now)
        const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
        const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? 'Mon'
        const currentDayOfWeek = weekdayMap[weekdayStr] ?? now.getDay()
        const diff = (currentDayOfWeek - weekStartDay + 7) % 7

        const year = parseInt(parts.find(p => p.type === 'year')?.value ?? '2000')
        const month = parseInt(parts.find(p => p.type === 'month')?.value ?? '1')
        const day = parseInt(parts.find(p => p.type === 'day')?.value ?? '1')

        const startUtc = new Date(Date.UTC(year, month - 1, day - diff))
        return getMidnightInTimezone(startUtc.getUTCFullYear(), startUtc.getUTCMonth() + 1, startUtc.getUTCDate(), timezone)
    } catch {
        // Pathological timezone string — fall back to UTC Monday so we at
        // least produce a consistent value across all call sites.
        const day = now.getUTCDay()
        const diff = (day === 0 ? -6 : 1) - day
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff))
    }
}

/**
 * Returns the start of the current quota period. "weekly" snaps to the
 * configured week start; "monthly" snaps to the first of the local month;
 * "lifetime" returns the unix epoch.
 */
export function getPeriodStart(
    periodType: 'weekly' | 'monthly' | 'lifetime',
    weekStartDay: number,
    timezone: string
): Date {
    if (periodType === 'lifetime') return new Date(0)
    if (periodType === 'weekly') return getWeekStart(weekStartDay, timezone)

    // Monthly — first of the month in `timezone`.
    const now = new Date()
    try {
        const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: 'numeric'
        })
        const parts = fmt.formatToParts(now)
        const year = parseInt(parts.find(p => p.type === 'year')?.value ?? '2000')
        const month = parseInt(parts.find(p => p.type === 'month')?.value ?? '1')
        return getMidnightInTimezone(year, month, 1, timezone)
    } catch {
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    }
}
