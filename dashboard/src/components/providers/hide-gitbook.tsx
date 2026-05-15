"use client"

import { useEffect } from "react"

export function HideGitBook() {
    useEffect(() => {
        const hide = () => {
            // @ts-expect-error GitBook global
            window.GitBook?.("hide")
        }

        // Script may not have loaded yet — try immediately and again after a short delay
        hide()
        const t = setTimeout(hide, 1500)

        return () => {
            clearTimeout(t)
            // @ts-expect-error GitBook global
            window.GitBook?.("show")
        }
    }, [])

    return null
}
