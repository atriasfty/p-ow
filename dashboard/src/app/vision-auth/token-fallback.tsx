"use client"

import { useState } from "react"
import { CopyButton } from "./copy-button"

/**
 * The manual copy-paste token display. When a deep-link scheme is present
 * the redirect is expected to just work, so this stays collapsed behind a
 * small reveal button instead of competing with "Redirecting…" for
 * attention — still one click away if the redirect doesn't fire.
 */
export function TokenFallback({ token, hiddenByDefault }: { token: string; hiddenByDefault: boolean }) {
    const [revealed, setRevealed] = useState(!hiddenByDefault)

    if (!revealed) {
        return (
            <div className="mb-6 text-center">
                <button
                    onClick={() => setRevealed(true)}
                    className="text-white/40 hover:text-white/60 text-xs underline transition-colors"
                >
                    Didn't work? Get a code
                </button>
            </div>
        )
    }

    return (
        <div className="mb-6">
            <label className="block text-white/40 text-xs uppercase font-bold mb-2">
                Your Token
            </label>
            <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-4">
                <code className="text-indigo-400 text-xs break-all select-all">{token}</code>
            </div>
            <p className="text-white/30 text-xs mt-2">This token expires in 7 days. Keep it secret!</p>
            <div className="mt-3">
                <CopyButton token={token} />
            </div>
        </div>
    )
}
