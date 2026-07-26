"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"

/**
 * Redacted placeholder bar. The landing page never renders fabricated names,
 * usernames, or numbers: anywhere real data would appear, we show one of these.
 */
export function Redact({ w, className = "" }: { w: number; className?: string }) {
    return (
        <span
            aria-hidden
            className={`inline-block h-2 shrink-0 rounded-full bg-white/[0.13] ${className}`}
            style={{ width: w }}
        />
    )
}

export function Reveal({
    children,
    delay = 0,
    className = "",
}: {
    children: ReactNode
    delay?: number
    className?: string
}) {
    const reduce = useReducedMotion()
    return (
        <motion.div
            className={className}
            initial={reduce ? false : { opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay, ease: [0.21, 0.6, 0.35, 1] }}
        >
            {children}
        </motion.div>
    )
}
