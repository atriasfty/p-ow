import { PrcServer, PrcPlayer, PrcJoinLog, PrcKillLog, PrcCommandLog, PrcServerV2 } from "./prc-types"
import { trackApiCall } from "./metrics"
import { getGlobalConfig } from "./config"

// Rate limit state per server key
interface RateLimitState {
    remaining: number
    resetTime: number  // Epoch timestamp in ms
    blockedUntil: number  // Epoch timestamp in ms (for 429 retry_after)
    lastWebhookTime: number // For cooldown
}

// Persist state across module reloads in Next.js using globalThis
const globalForPrc = globalThis as unknown as {
    rateLimitStates: Map<string, RateLimitState> | undefined;
    requestQueues: Map<string, Promise<unknown>> | undefined;
};

// Global rate limit tracking (keyed by server API key hash for privacy)
const rateLimitStates = globalForPrc.rateLimitStates ??= new Map<string, RateLimitState>()

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

    private getState(): RateLimitState {
        if (!rateLimitStates.has(this.keyHash)) {
            rateLimitStates.set(this.keyHash, {
                remaining: 35,
                resetTime: Date.now() + 1000,
                blockedUntil: 0,
                lastWebhookTime: 0
            })
        }
        return rateLimitStates.get(this.keyHash)!
    }

    private updateState(state: Partial<RateLimitState>) {
        const current = this.getState()
        rateLimitStates.set(this.keyHash, { ...current, ...state })
    }

    private async waitIfNeeded(): Promise<void> {
        const state = this.getState()
        const now = Date.now()

        // 1. Check if we are in a hard block (429)
        if (state.blockedUntil > now) {
            const waitTime = state.blockedUntil - now
            await new Promise(resolve => setTimeout(resolve, waitTime + 100))
        }

        // 2. Check if we reached the bucket limit (35 req/sec)
        // If resetTime passed, reset the bucket
        if (now > state.resetTime) {
            this.updateState({ remaining: 35, resetTime: now + 1000 })
            return
        }

        // If no requests left, wait for reset
        if (state.remaining <= 0) {
            const waitTime = state.resetTime - now
            await new Promise(resolve => setTimeout(resolve, waitTime + 100))
            this.updateState({ remaining: 35, resetTime: Date.now() + 1000 })
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
        await this.waitIfNeeded()

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

            // Update remaining requests from headers
            const remaining = res.headers.get("X-RateLimit-Remaining")
            if (remaining) {
                this.updateState({ remaining: parseInt(remaining) })
            }

            if (res.status === 429) {
                const retryAfter = parseInt(res.headers.get("Retry-After") || "2")
                this.updateState({ blockedUntil: Date.now() + (retryAfter * 1000) })

                if (retryCount < MAX_RETRIES) {
                    return this.doFetch<T>(endpoint, options, retryCount + 1)
                }
                throw new Error("PRC API Rate Limit Exceeded")
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
