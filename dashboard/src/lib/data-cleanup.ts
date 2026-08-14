import { prisma } from "./db"
import { dataCleanupDuration, dataCleanupRowsDeleted } from "./prometheus"

const PUNISHMENT_MIN_RETENTION_DAYS = 730 // 2 years, all plans

/**
 * Delete records older than `retentionDays` for a specific server.
 * Only deletes completed shifts (endTime not null) to preserve active sessions.
 * Punishments use a minimum of PUNISHMENT_MIN_RETENTION_DAYS regardless of plan.
 */
export async function runDataCleanup(serverId: string, retentionDays: number): Promise<void> {
    if (retentionDays <= 0) return // 0 = no retention limit (never purge)

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    const punishmentRetentionDays = Math.max(retentionDays, PUNISHMENT_MIN_RETENTION_DAYS)
    const punishmentCutoff = new Date(Date.now() - punishmentRetentionDays * 24 * 60 * 60 * 1000)

    console.log(`[CLEANUP] Server ${serverId}: deleting records older than ${retentionDays} days (before ${cutoff.toISOString()}), punishments older than ${punishmentRetentionDays} days`)

    const start = Date.now()
    const [log, playerLocation, vehicleLog, shift, punishment, modCall, emergencyCall] = await Promise.all([
        prisma.log.deleteMany({ where: { serverId, createdAt: { lt: cutoff } } }),
        prisma.playerLocation.deleteMany({ where: { serverId, createdAt: { lt: cutoff } } }),
        prisma.vehicleLog.deleteMany({ where: { serverId, createdAt: { lt: cutoff } } }),
        prisma.shift.deleteMany({ where: { serverId, endTime: { lt: cutoff } } }),
        prisma.punishment.deleteMany({ where: { serverId, createdAt: { lt: punishmentCutoff } } }),
        prisma.modCall.deleteMany({ where: { serverId, createdAt: { lt: cutoff } } }),
        prisma.emergencyCall.deleteMany({ where: { serverId, createdAt: { lt: cutoff } } }),
    ])
    dataCleanupDuration.observe({ server_id: serverId }, (Date.now() - start) / 1000)
    for (const [model, result] of [
        ["Log", log], ["PlayerLocation", playerLocation], ["VehicleLog", vehicleLog],
        ["Shift", shift], ["Punishment", punishment], ["ModCall", modCall],
        ["EmergencyCall", emergencyCall],
    ] as const) {
        if (result.count > 0) dataCleanupRowsDeleted.inc({ model }, result.count)
    }

    console.log(`[CLEANUP] Server ${serverId}: cleanup complete`)
}

/**
 * Run cleanup for a server only if it hasn't been run in the last 24 hours.
 * Tracks last run time via the Config table with key `cleanup:${serverId}:last`.
 */
export async function maybeRunDataCleanup(serverId: string, retentionDays: number): Promise<void> {
    if (retentionDays <= 0) return

    const configKey = `cleanup:${serverId}:last`
    const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000

    try {
        const existing = await prisma.config.findUnique({ where: { key: configKey } })

        if (existing) {
            const lastRun = new Date(JSON.parse(existing.value)).getTime()
            if (Date.now() - lastRun < CLEANUP_INTERVAL_MS) {
                return // Too soon — skip
            }
        }

        // Update/create the last-run timestamp BEFORE running cleanup
        // to prevent duplicate runs in multi-process deploys
        await prisma.config.upsert({
            where: { key: configKey },
            update: { value: JSON.stringify(new Date().toISOString()) },
            create: { key: configKey, value: JSON.stringify(new Date().toISOString()) }
        })

        await runDataCleanup(serverId, retentionDays)
    } catch (e) {
        console.error(`[CLEANUP] Error running cleanup for server ${serverId}:`, e)
    }
}
