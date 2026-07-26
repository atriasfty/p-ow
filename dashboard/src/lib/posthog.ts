import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null

export default function PostHogClient() {
    if (!posthogClient) {
        posthogClient = new PostHog(
            process.env.NEXT_PUBLIC_POSTHOG_KEY!,
            {
                host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
                // Batch events — one HTTP request per ~20 events or every 10s,
                // instead of one request per event. The status dashboard reads
                // with up to ~10s lag, which is acceptable.
                flushAt: 20,
                flushInterval: 10000
            }
        )
    }
    return posthogClient
}

