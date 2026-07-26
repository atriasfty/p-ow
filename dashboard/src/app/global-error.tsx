"use client"

import { useEffect } from "react"
import posthog from "posthog-js"

/**
 * Root error boundary — catches fatal render errors that would otherwise
 * white-screen the app with no trace. Reports to PostHog error tracking.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        try {
            if (posthog.__loaded) {
                posthog.captureException(error, { source: "global-error", digest: error.digest })
            } else if (typeof navigator !== "undefined" && navigator.sendBeacon) {
                // global-error.tsx replaces the root layout, so it fires precisely
                // when the layout (and PostHog's init inside it) never ran. Fall back
                // to a beacon that doesn't depend on PostHog being loaded.
                navigator.sendBeacon(
                    "/api/client-error",
                    new Blob([JSON.stringify({ message: error.message, digest: error.digest })], { type: "application/json" })
                )
            }
        } catch {
            // reporting must not break the error page itself
        }
    }, [error])

    return (
        <html>
            <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0a0a0a", color: "#fafafa", margin: 0 }}>
                <div style={{ textAlign: "center", padding: 24 }}>
                    <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
                    <p style={{ color: "#a1a1aa", marginBottom: 16 }}>The error has been reported. Try again or refresh the page.</p>
                    <button
                        onClick={reset}
                        style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #3f3f46", background: "#18181b", color: "#fafafa", cursor: "pointer" }}
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    )
}
