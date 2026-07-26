"use client"

import { useEffect } from "react"
import posthog from "posthog-js"

/**
 * Nested (route-level) error boundary. Unlike global-error.tsx this renders
 * INSIDE the root layout, so a render error in a page/component is caught here
 * without tearing down the app shell (nav, providers). global-error.tsx remains
 * the last resort for failures in the root layout itself.
 */
export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        try {
            // The root layout rendered, so PostHog should be initialised here
            // (unlike the global-error case).
            if (posthog.__loaded) {
                posthog.captureException(error, { source: "route-error", digest: error.digest })
            }
        } catch {
            // reporting must not break the error page itself
        }
    }, [error])

    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 24 }}>
            <div style={{ textAlign: "center", maxWidth: 420 }}>
                <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
                <p style={{ color: "#a1a1aa", marginBottom: 16 }}>
                    This section failed to load. The error has been reported.
                </p>
                <button
                    onClick={reset}
                    style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #3f3f46", background: "#18181b", color: "#fafafa", cursor: "pointer" }}
                >
                    Try again
                </button>
            </div>
        </div>
    )
}
