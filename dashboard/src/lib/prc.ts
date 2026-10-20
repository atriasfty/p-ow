import { PrcServer, PrcPlayer, PrcJoinLog, PrcKillLog, PrcCommandLog, PrcServerV2 } from "./prc-types"
import { trackApiCall } from "./metrics"
import { outboundRateLimitHits } from "./prometheus"
import { getGlobalConfig } from "./config"

// Thrown when PRC has told us a server-key is invalid (403). Distinct from
// generic/429/timeout errors so callers can stop retrying instead of hammering
// PRC with the same dead key — repeated 403s on an invalid key are grounds for
// a permanent IP ban per PRC's API use guidelines.
export class PrcInvalidKeyError extends Error {
    constructor(message = "Invalid PRC API Key (403)") {
        super(message)
        this.name = "PrcInvalidKeyError"
    }
}

// A single 403 can be a transient PRC-side blip rather than a genuinely dead
// key — confirmed in production on 2026-10-18, where one sync cycle got 403
// for 5 unrelated servers within 21 seconds, permanently latching all 5.
// Require this many consecutive 403s (across separate cycles, ~4s apart)
// before treating the key as actually revoked.
const PRC_INVALID_KEY_CONFIRM_THRESHOLD = 3

// Per-key state — not tied to any one rate-limit bucket.
interface KeyState {
    invalidKey: boolean  // Set once PRC has returned 403 for this key PRC_INVALID_KEY_CONFIRM_THRESHOLD times in a row — stop making requests entirely
    consecutive403s: number  // Reset to 0 on any non-403 response
    lastWebhookTime: number // For cooldown
}

// Per-(key, bucket) rate-limit state. PRC enforces separate buckets per route
// (X-RateLimit-Bucket) — most notably POST /server/command, which docs cap at
// 1 request per 5 seconds vs. the much looser global bucket. Tracking only a
// single shared counter let command-route bursts (e.g. several shift-PM
// automations firing in one sync cycle) blow through that tighter limit
// without the code ever noticing it had happened.
interface BucketState {
    remaining: number
    limit: number  // Learned from X-RateLimit-Limit; falls back to BUCKET_DEFAULTS until then — docs say don't hardcode this
    resetTime: number  // Epoch timestamp in ms
    blockedUntil: number  // Epoch timestamp in ms (for 429 retry_after)
}

// Starting assumptions only — overwritten as soon as real X-RateLimit-Limit /
// X-RateLimit-Bucket headers come back, per PRC's "don't hardcode rate limit
// values" guidance. The command default comes straight from their docs.
const BUCKET_DEFAULTS: Record<string, { limit: number; windowMs: number }> = {
    global: { limit: 35, windowMs: 1000 },
    command: { limit: 1, windowMs: 5000 },
}

// Classify a request into PRC's bucket scheme before sending it, so the
// outbound wait can respect the right limit without needing a prior response.
function classifyBucket(endpoint: string): "global" | "command" {
    return endpoint.startsWith("/server/command") ? "command" : "global"
}

// Persist state across module reloads in Next.js using globalThis
const globalForPrc = globalThis as unknown as {
    keyStates: Map<string, KeyState> | undefined;
    bucketStates: Map<string, BucketState> | undefined;
    requestQueues: Map<string, Promise<unknown>> | undefined;
};

// Keyed by server API key hash for privacy
const keyStates = globalForPrc.keyStates ??= new Map<string, KeyState>()

// Keyed by `${keyHash}:${bucket}` — see BucketState above
const bucketStates = globalForPrc.bucketStates ??= new Map<string, BucketState>()

// Request queue to serialize requests per server key (prevents parallel requests bypassing rate limits)
const requestQueues = globalForPrc.requestQueues ??= new Map<string, Promise<unknown>>()

function getKeyHash(apiKey: string): string {
    return apiKey.slice(-8)
}

export interface PrcV2Params {
    Players?: boolean
    Staff?: boolean
    JoinLogs?: boolean
    KillLogs?: boolean
    CommandLogs?: boolean
    ModCalls?: boolean
    EmergencyCalls?: boolean
    Vehicles?: boolean
}

export class PrcClient {
    private apiKey: string
    private keyHash: string
    private baseUrl: string | null = null

    constructor(apiKey: string) {
        this.apiKey = apiKey
        this.keyHash = getKeyHash(apiKey)
    }

    private async getBaseUrl() {
        if (this.baseUrl) return this.baseUrl
        this.baseUrl = await getGlobalConfig("PRC_BASE_URL")
        return this.baseUrl
    }

    private getKeyState(): KeyState {
        if (!keyStates.has(this.keyHash)) {
            keyStates.set(this.keyHash, {
                invalidKey: false,
                consecutive403s: 0,
                lastWebhookTime: 0,
            })
        }
        return keyStates.get(this.keyHash)!
    }

    private updateKeyState(state: Partial<KeyState>) {
        const current = this.getKeyState()
        keyStates.set(this.keyHash, { ...current, ...state })
    }

    private getBucketState(bucket: string): BucketState {
        const stateKey = `${this.keyHash}:${bucket}`
        if (!bucketStates.has(stateKey)) {
            const defaults = BUCKET_DEFAULTS[bucket] || BUCKET_DEFAULTS.global
            bucketStates.set(stateKey, {
                remaining: defaults.limit,
                limit: defaults.limit,
                resetTime: Date.now() + defaults.windowMs,
                blockedUntil: 0,
            })
        }
        return bucketStates.get(stateKey)!
    }

    private updateBucketState(bucket: string, state: Partial<BucketState>) {
        const current = this.getBucketState(bucket)
        bucketStates.set(`${this.keyHash}:${bucket}`, { ...current, ...state })
    }

    private async waitIfNeeded(bucket: string): Promise<void> {
        const state = this.getBucketState(bucket)
        const now = Date.now()
        const windowMs = (BUCKET_DEFAULTS[bucket] || BUCKET_DEFAULTS.global).windowMs

        // 1. Check if we are in a hard block (429)
        if (state.blockedUntil > now) {
            const waitTime = state.blockedUntil - now
            await new Promise(resolve => setTimeout(resolve, waitTime + 100))
        }

        // 2. Check if we reached this bucket's limit (learned from
        // X-RateLimit-Limit, or the documented default until then).
        // If resetTime passed, reset the bucket
        if (now > state.resetTime) {
            this.updateBucketState(bucket, { remaining: state.limit, resetTime: now + windowMs })
            return
        }

        // If no requests left, wait for reset
        if (state.remaining <= 0) {
            const waitTime = state.resetTime - now
            await new Promise(resolve => setTimeout(resolve, waitTime + 100))
            this.updateBucketState(bucket, { remaining: state.limit, resetTime: Date.now() + windowMs })
        }
    }

    /**
     * Serialized fetch to ensure rate limits are respected across concurrent calls
     */
    private async fetchDirect<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const currentQueue = requestQueues.get(this.keyHash) || Promise.resolve()

        const thisRequest = currentQueue.then(() => this.doFetch<T>(endpoint, options))
        requestQueues.set(this.keyHash, thisRequest.catch(() => { }))

        return thisRequest
    }

    private async doFetch<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
        const MAX_RETRIES = 3
        const bucket = classifyBucket(endpoint)

        // Once PRC_INVALID_KEY_CONFIRM_THRESHOLD consecutive 403s have
        // confirmed this key is dead, never send it again — repeated requests
        // with a known-dead key risk a permanent IP ban.
        if (this.getKeyState().invalidKey) {
            throw new PrcInvalidKeyError()
        }

        await this.waitIfNeeded(bucket)

        const baseUrl = await this.getBaseUrl()
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)
        const startTime = Date.now()

        try {
            const res = await fetch(`${baseUrl}${endpoint}`, {
                ...options,
                headers: { "Server-Key": this.apiKey, ...options.headers },
                signal: controller.signal
            })

            const duration = Date.now() - startTime
            trackApiCall("prc", endpoint.split("?")[0], duration, res.ok ? "ok" : "error", undefined, undefined, res.status)

            // Learn the real bucket size/remaining from PRC's own headers
            // instead of trusting our pre-request guess — docs say these can
            // vary per application and must not be hardcoded.
            const remaining = res.headers.get("X-RateLimit-Remaining")
            const limitHeader = res.headers.get("X-RateLimit-Limit")
            const limit = limitHeader ? parseInt(limitHeader) : undefined
            if (remaining || limit) {
                this.updateBucketState(bucket, {
                    ...(remaining ? { remaining: parseInt(remaining) } : {}),
                    ...(limit ? { limit } : {}),
                })
            }

            if (res.status === 429) {
                outboundRateLimitHits.inc({ service: "prc" })
                const retryAfter = parseInt(res.headers.get("Retry-After") || "2")
                this.updateBucketState(bucket, { blockedUntil: Date.now() + (retryAfter * 1000) })

                if (retryCount < MAX_RETRIES) {
                    return this.doFetch<T>(endpoint, options, retryCount + 1)
                }
                throw new Error("PRC API Rate Limit Exceeded")
            }

            if (res.status === 403) {
                const consecutive403s = (this.getKeyState().consecutive403s || 0) + 1
                if (consecutive403s >= PRC_INVALID_KEY_CONFIRM_THRESHOLD) {
                    this.updateKeyState({ invalidKey: true, consecutive403s })
                    throw new PrcInvalidKeyError()
                }
                // Not yet confirmed — record the strike but let the next cycle
                // retry normally instead of latching on a single 403.
                this.updateKeyState({ consecutive403s })
                throw new Error(`PRC API Error (403): key rejected, confirming (${consecutive403s}/${PRC_INVALID_KEY_CONFIRM_THRESHOLD})`)
            }

            // Any non-403 response (success or another error status) clears a
            // partial 403 strike count — it was transient, not a dead key.
            if (this.getKeyState().consecutive403s > 0) {
                this.updateKeyState({ consecutive403s: 0 })
            }

            if (!res.ok) {
                const text = await res.text()
                throw new Error(`PRC API Error (${res.status}): ${text}`)
            }

            return await res.json() as T
        } finally {
            clearTimeout(timeoutId)
        }
    }

    /**
     * Unified v2 Server Fetch
     */
    async getServerV2(params: PrcV2Params = {}): Promise<PrcServerV2> {
        const query = new URLSearchParams()
        Object.entries(params).forEach(([key, val]) => {
            if (val) query.set(key, "true")
        })
        const qs = query.toString()
        return this.fetchDirect<PrcServerV2>(`/server${qs ? `?${qs}` : ""}`)
    }

    /**
     * Legacy Compatibility (Bridges to v2)
     */
    async getServer(): Promise<PrcServer> {
        return this.getServerV2()
    }

    async getPlayers(): Promise<PrcPlayer[]> {
        const res = await this.getServerV2({ Players: true })
        return res.Players || []
    }

    async getJoinLogs(): Promise<PrcJoinLog[]> {
        const res = await this.getServerV2({ JoinLogs: true })
        return res.JoinLogs || []
    }

    async getKillLogs(): Promise<PrcKillLog[]> {
        const res = await this.getServerV2({ KillLogs: true })
        return res.KillLogs || []
    }

    async getCommandLogs(): Promise<PrcCommandLog[]> {
        const res = await this.getServerV2({ CommandLogs: true })
        return res.CommandLogs || []
    }

    async executeCommand(command: string): Promise<any> {
        return this.fetchDirect("/server/command", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command })
        })
    }
}
