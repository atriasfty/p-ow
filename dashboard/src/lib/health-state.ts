/**
 * In-process health state shared between the sync route, SSE route and
 * /api/health. Stored on globalThis so route-module duplication / HMR
 * doesn't split the state.
 */

const g = globalThis as unknown as {
    _powHealth?: {
        lastSyncAt: number | null
        lastSyncOkAt: number | null
        consecutiveSyncFailures: Map<string, number>
        sseConnections: number
        // Per-server last successful sync cycle — set unconditionally on
        // success (see api/internal/sync/route.ts), independent of whether
        // the cycle found any new logs/players. A server with zero players
        // still syncs successfully every cycle; PlayerLocation-based
        // "activity" checks (e.g. projector-stats) wrongly treated a quiet
        // server as sync-stale, when it was really just empty.
        lastSyncOkAtByServer: Map<string, number>
    }
}

export const healthState = g._powHealth || (g._powHealth = {
    lastSyncAt: null,
    lastSyncOkAt: null,
    consecutiveSyncFailures: new Map(),
    sseConnections: 0,
    lastSyncOkAtByServer: new Map(),
})
