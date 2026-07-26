import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { healthState } from "@/lib/health-state"

export const dynamic = "force-dynamic"

// Sync cycles run every ~4s (driven by the bot). If nothing has synced for
// this long, the pipeline is stale even though the process is alive.
const SYNC_STALE_MS = 90 * 1000

export async function GET(req: Request) {
    const checks: Record<string, any> = {}
    let status: "ok" | "degraded" | "down" = "ok"

    // Detailed vitals (memory, uptime, connection counts, error strings) are
    // reconnaissance for an unauthenticated caller. Gate them behind the internal
    // secret; the public response still carries ok/status so uptime monitors and
    // the deploy gate keep working.
    const internalSecret = process.env.INTERNAL_SYNC_SECRET
    const authed = !!internalSecret && req.headers.get("x-internal-secret") === internalSecret

    // Database — bounded so a locked/hung DB returns 503 promptly instead of
    // hanging the request indefinitely.
    try {
        const start = Date.now()
        await Promise.race([
            prisma.$queryRaw`SELECT 1`,
            new Promise((_, reject) => setTimeout(() => reject(new Error("db health check timed out")), 2000)),
        ])
        checks.db = { ok: true, latencyMs: Date.now() - start }
    } catch (e: any) {
        checks.db = authed ? { ok: false, error: e.message } : { ok: false }
        status = "down"
    }

    // Sync pipeline freshness (in-process; null right after a restart until
    // the bot triggers the first cycle)
    const { lastSyncAt, lastSyncOkAt, sseConnections } = healthState
    const syncAge = lastSyncAt ? Date.now() - lastSyncAt : null
    const uptimeSec = Math.round(process.uptime())
    const syncStale = syncAge !== null
        ? syncAge > SYNC_STALE_MS
        : uptimeSec > 180 // never synced despite being up for a while
    checks.sync = {
        ok: !syncStale,
        lastSyncAgoMs: syncAge,
        lastSyncOkAgoMs: lastSyncOkAt ? Date.now() - lastSyncOkAt : null,
    }
    if (syncStale && status === "ok") status = "degraded"

    // Process vitals — recon data, only exposed to internally-authenticated callers.
    if (authed) {
        const mem = process.memoryUsage()
        checks.process = {
            uptimeSec,
            rssMb: Math.round(mem.rss / 1024 / 1024),
            heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
            sseConnections,
        }
    } else {
        // Strip the sync-freshness internals too; keep only the ok flag.
        checks.sync = { ok: checks.sync.ok }
    }

    return NextResponse.json(
        { ok: status !== "down", status, service: "pow-dashboard", checks },
        { status: status === "down" ? 503 : 200 }
    )
}
