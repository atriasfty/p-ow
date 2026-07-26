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
    }
}

export const healthState = g._powHealth || (g._powHealth = {
    lastSyncAt: null,
    lastSyncOkAt: null,
    consecutiveSyncFailures: new Map(),
    sseConnections: 0,
})
