import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = 'https://a.atriasafety.org'

let isInitialized = false

export function initPostHog() {
    if (isInitialized) return

    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        autocapture: true,
        capture_pageview: true,
        capture_pageleave: true,
        session_recording: {
            maskAllInputs: false,
            maskInputOptions: {
                password: true,
            },
        },
        capture_exceptions: true,
        loaded: (posthog) => {
            // Enable session recording
            posthog.startSessionRecording()
        }
    })

    isInitialized = true
}

export interface UserIdentity {
    userId: string
    name?: string
    username?: string
    email?: string
    image?: string
    robloxId?: string
    robloxUsername?: string
    discordId?: string
    discordUsername?: string
}

export function identifyUser(identity: UserIdentity) {
    if (!isInitialized) {
        initPostHog()
    }

    posthog.identify(identity.userId, {
        name: identity.name,
        username: identity.username,
        email: identity.email,
        image: identity.image,
        roblox_id: identity.robloxId,
        roblox_username: identity.robloxUsername,
        discord_id: identity.discordId,
        discord_username: identity.discordUsername,
        platform: 'vision_desktop',
    })
}

export function resetUser() {
    posthog.reset()
}

export function captureEvent(event: string, properties?: Record<string, any>) {
    posthog.capture(event, properties)
}

export function captureException(error: Error, context?: Record<string, any>) {
    posthog.capture('$exception', {
        $exception_message: error.message,
        $exception_type: error.name,
        $exception_stack_trace_raw: error.stack,
        ...context,
    })
}

export { posthog }
