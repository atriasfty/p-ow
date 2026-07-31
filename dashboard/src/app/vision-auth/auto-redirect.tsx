"use client"

import { useEffect, useState } from "react"

/**
 * Deep-link handoff for native Vision clients. Additive to the existing
 * copy-paste flow, not a replacement — some platforms/first-runs fail to
 * register the custom URL scheme, so copy-paste stays visible as a
 * fallback regardless of whether this fires.
 */
export function AutoRedirect({ token, scheme }: { token: string; scheme: string }) {
    const [attempted, setAttempted] = useState(false)

    useEffect(() => {
        const url = `${scheme}://auth?token=${encodeURIComponent(token)}`
        window.location.href = url
        setAttempted(true)
    }, [token, scheme])

    return (
        <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
            <p className="text-emerald-400 text-sm text-center">
                {attempted
                    ? "Redirecting back to the app… if nothing happened, use the token below."
                    : "Returning to the app…"}
            </p>
        </div>
    )
}
