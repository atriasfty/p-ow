"use client"

import { useEffect } from "react"

/**
 * Deep-link handoff for native Vision clients. Fires once on mount and
 * gets out of the way — the page's "Redirecting…" heading plus
 * TokenFallback's collapsed fallback button cover the messaging, so this
 * doesn't need its own status box.
 */
export function AutoRedirect({ token, scheme }: { token: string; scheme: string }) {
    useEffect(() => {
        window.location.href = `${scheme}://auth?token=${encodeURIComponent(token)}`
    }, [token, scheme])

    return (
        <div className="mb-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
    )
}
