import { lastSyncTimestamp, syncCycleFailures, pruneOrphanedServerMetrics } from "./prometheus"

describe("pruneOrphanedServerMetrics", () => {
    afterEach(async () => {
        // These metrics are on a shared, process-global registry (see
        // prometheus.ts's globalThis guard) — reset between tests so one
        // test's labels can't leak into the next.
        lastSyncTimestamp.reset()
        syncCycleFailures.reset()
    })

    it("removes label sets for servers no longer in the active set", async () => {
        lastSyncTimestamp.labels("still-here").set(100)
        lastSyncTimestamp.labels("deleted-server").set(200)

        const pruned = await pruneOrphanedServerMetrics(new Set(["still-here"]))

        expect(pruned).toBeGreaterThanOrEqual(1)
        const data = await lastSyncTimestamp.get()
        const ids = data.values.map(v => v.labels.server_id)
        expect(ids).toContain("still-here")
        expect(ids).not.toContain("deleted-server")
    })

    it("leaves everything alone when all labeled servers are still active", async () => {
        lastSyncTimestamp.labels("a").set(1)
        syncCycleFailures.labels("a").inc()

        const pruned = await pruneOrphanedServerMetrics(new Set(["a"]))

        expect(pruned).toBe(0)
    })

    it("prunes across every server-labeled metric, not just lastSyncTimestamp", async () => {
        syncCycleFailures.labels("orphan").inc()

        await pruneOrphanedServerMetrics(new Set())

        const data = await syncCycleFailures.get()
        expect(data.values.map(v => v.labels.server_id)).not.toContain("orphan")
    })
})
