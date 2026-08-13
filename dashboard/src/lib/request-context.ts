import { AsyncLocalStorage } from "async_hooks"
import crypto from "crypto"

/**
 * Lightweight per-cycle correlation ID — not full distributed tracing, just
 * enough to reconstruct one PRC-poll -> DB-write -> SSE-emit chain in Loki
 * via `grep`/`{correlationId="..."}`. Propagates automatically through any
 * async call chain started inside runWithCorrelationId (including
 * synchronous EventEmitter listener callbacks invoked from within it —
 * covers the sync route -> event-bus.ts -> SSE subscriber chain without
 * needing to pass an ID through every function signature).
 */

const als = new AsyncLocalStorage<string>()

export function newCorrelationId(): string {
    return crypto.randomUUID().slice(0, 8)
}

export function runWithCorrelationId<T>(id: string, fn: () => T): T {
    return als.run(id, fn)
}

export function getCorrelationId(): string | undefined {
    return als.getStore()
}
