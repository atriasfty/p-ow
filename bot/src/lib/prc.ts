
const BASE_URL = "https://api.erlc.gg/v1"
const DEFAULT_WEBHOOK_URL = process.env.DISCORD_PUNISHMENT_WEBHOOK || ""

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

export interface PrcServer {
    Name: string
    OwnerId: number
    CoOwnerIds: number[]
    CurrentPlayers: number
    MaxPlayers: number
    JoinKey: string
    AccVerifiedReq: string
    TeamBalance: boolean
}

// Rate limit state per server key
interface RateLimitState {
    remaining: number
    resetTime: number  // Epoch timestamp in ms
    blockedUntil: number  // Epoch timestamp in ms (for 429 retry_after)
    lastWebhookTime: number // For cooldown
    invalidKey: boolean  // Set once PRC returns 403 for this key — stop making requests entirely
}

// Persist state across module reloads using globalThis (useful if using ts-node/register or similar in dev)
const globalForPrc = globalThis as unknown as {
    rateLimitStates: Map<string, RateLimitState> | undefined;
    requestQueues: Map<string, Promise<unknown>> | undefined;
};

// Global rate limit tracking (keyed by server API key hash for privacy)
const rateLimitStates = globalForPrc.rateLimitStates ??= new Map<string, RateLimitState>()

// Request queue to serialize requests per server key (prevents parallel requests bypassing rate limits)
const requestQueues = globalForPrc.requestQueues ??= new Map<string, Promise<unknown>>()

function getKeyHash(apiKey: string): string {
    // Simple hash to avoid storing full API keys in memory
    return apiKey.slice(-8)
}

export class PrcClient {
    private apiKey: string
    private keyHash: string

    constructor(apiKey: string) {
        this.apiKey = apiKey
        this.keyHash = getKeyHash(apiKey)
    }

    private getState(): RateLimitState {
        if (!rateLimitStates.has(this.keyHash)) {
            rateLimitStates.set(this.keyHash, {
                remaining: 35,  // Default from docs
                resetTime: Date.now() + 1000,
                blockedUntil: 0,
                lastWebhookTime: 0,
                invalidKey: false
            })
        }
        return rateLimitStates.get(this.keyHash)!
    }

    private updateState(headers: Headers, retryAfter?: number) {
        const state = this.getState()

        const remaining = headers.get("X-RateLimit-Remaining")
        const reset = headers.get("X-RateLimit-Reset")

        if (remaining !== null) {
            state.remaining = parseInt(remaining, 10)
        }
        if (reset !== null) {
            // Reset is epoch timestamp in seconds, convert to ms
            state.resetTime = parseInt(reset, 10) * 1000
        }
        if (retryAfter !== undefined) {
            state.blockedUntil = Date.now() + (retryAfter * 1000)

            // Send webhook if we're hitting a 429 and haven't sent one recently (2 min cooldown)
            if (Date.now() - state.lastWebhookTime > 120000) {
                this.sendRateLimitWebhook(retryAfter)
                state.lastWebhookTime = Date.now()
            }
        }
    }

    private async sendRateLimitWebhook(retryAfter: number) {
        const webhookUrl = process.env.PRC_RATE_LIMIT_WEBHOOK || DEFAULT_WEBHOOK_URL
        if (!webhookUrl) return

        const waitHours = Math.floor(retryAfter / 3600)
        const waitMinutes = Math.floor((retryAfter % 3600) / 60)
        const waitSeconds = Math.floor(retryAfter % 60)

        let waitString = ""
        if (waitHours > 0) waitString += `${waitHours}h `
        if (waitMinutes > 0) waitString += `${waitMinutes}m `
        if (waitSeconds > 0 || waitString === "") waitString += `${waitSeconds}s`

        try {
            await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    embeds: [{
                        title: "🚨 PRC API Rate Limited (Bot)",
                        description: `The Discord Bot has been rate limited by the PRC API.\n\n**Wait Time:** \`${waitString}\` (${retryAfter}s)`,
                        color: 15548997, // Red
                        timestamp: new Date().toISOString(),
                        fields: [
                            { name: "Key Hash", value: `\`...${this.keyHash}\``, inline: true }
                        ]
                    }]
                })
            })
        } catch (e) {
            console.error("[PRC] Failed to send rate limit webhook:", e)
        }
    }

    private async waitIfNeeded(): Promise<void> {
        const state = this.getState()
        const now = Date.now()

        // Check if we're still blocked from a 429
        if (state.blockedUntil > now) {
            const waitTime = state.blockedUntil - now
            console.log(`[PRC] Rate limited, waiting ${waitTime}ms before retry...`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            return
        }

        // Proactive: if remaining is 0 and reset is in the future, wait
        if (state.remaining <= 0 && state.resetTime > now) {
            const waitTime = state.resetTime - now + 100  // +100ms buffer
            console.log(`[PRC] Proactive rate limit wait: ${waitTime}ms`)

            // If proactive wait is long (> 1 min), notify via webhook
            if (waitTime > 60000 && now - state.lastWebhookTime > 300000) {
                this.sendRateLimitWebhook(Math.ceil(waitTime / 1000))
                state.lastWebhookTime = now
            }

            await new Promise(resolve => setTimeout(resolve, waitTime))
            // Reset state after waiting
            state.remaining = 35
        }
    }

    private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        // Serialize requests per API key to prevent parallel requests that bypass rate limits
        const currentQueue = requestQueues.get(this.keyHash) || Promise.resolve()

        const thisRequest = currentQueue.then(async () => {
            return this.doFetch<T>(endpoint, options)
        })

        // Update queue - catch errors to prevent queue from getting stuck
        requestQueues.set(this.keyHash, thisRequest.catch(() => { }))

        return thisRequest
    }

    private async doFetch<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
        const MAX_RETRIES = 3

        // Once PRC has told us this key is invalid (403), never send it again —
        // repeated requests with a known-dead key risk a permanent IP ban.
        if (this.getState().invalidKey) {
            throw new PrcInvalidKeyError()
        }

        // Wait if we're rate limited
        await this.waitIfNeeded()

        const url = `${BASE_URL}${endpoint}`

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)

        try {
            const res = await fetch(url, {
                ...options,
                headers: {
                    "Server-Key": this.apiKey,
                    ...options.headers,
                },
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            // Always update rate limit state from headers
            this.updateState(res.headers)

            if (!res.ok) {
                if (res.status === 429) {
                    // Parse retry_after from response body
                    let retryAfter = 5  // Default 5 seconds
                    try {
                        const body = await res.json()
                        retryAfter = body.retry_after || 5
                    } catch (e) {
                        // If can't parse, use default
                    }

                    this.updateState(res.headers, retryAfter)
                    console.log(`[PRC] 429 Rate Limited! retry_after: ${retryAfter}s (attempt ${retryCount + 1}/${MAX_RETRIES})`)

                    // Retry if we haven't exceeded max retries
                    if (retryCount < MAX_RETRIES) {
                        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
                        return this.doFetch<T>(endpoint, options, retryCount + 1)
                    }

                    throw new Error("Rate Limited")
                }
                if (res.status === 403) {
                    this.getState().invalidKey = true
                    throw new PrcInvalidKeyError()
                }
                throw new Error(`PRC API Error: ${res.statusText}`)
            }

            const text = await res.text()
            try {
                return text ? JSON.parse(text) : {} as any as T
            } catch (e) {
                return {} as any as T
            }
        } catch (error: any) {
            clearTimeout(timeoutId)
            if (error.name === 'AbortError') {
                throw new Error("PRC API Timeout")
            }
            throw error
        }
    }

    async getServer(): Promise<PrcServer> {
        return this.fetch<PrcServer>("/server")
    }

    async getPlayers() {
        return this.fetch<any[]>("/server/players")
    }

    async getJoinLogs() {
        return this.fetch<any[]>("/server/joinlogs")
    }

    async getKillLogs() {
        return this.fetch<any[]>("/server/killlogs")
    }

    async getCommandLogs() {
        return this.fetch<any[]>("/server/commandlogs")
    }

    async executeCommand(command: string) {
        return this.fetch("/server/command", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ command })
        })
    }
}
