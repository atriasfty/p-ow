"use client"

import React, { useEffect, useState } from "react"
import { useLiveEditor } from "./live-editor-provider"
import { motion, AnimatePresence } from "framer-motion"

export function LiveCursors() {
    const { awareness, connected } = useLiveEditor()
    const [others, setOthers] = useState<any[]>([])

    // 1. Maintain local pointer move listener and broadcast
    useEffect(() => {
        if (!awareness || !connected) return

        let idleTimeout: NodeJS.Timeout

        const handlePointerMove = (e: PointerEvent) => {
            // Use absolute page coordinates so scrolling is synced
            const cursor = {
                x: e.pageX,
                y: e.pageY
            }
            awareness.setLocalStateField("cursor", cursor)

            if (idleTimeout) clearTimeout(idleTimeout)
            idleTimeout = setTimeout(() => {
                awareness.setLocalStateField("cursor", null)
            }, 4000)
        }

        const handlePointerLeave = () => {
            if (idleTimeout) clearTimeout(idleTimeout)
            awareness.setLocalStateField("cursor", null) // hide cursor
        }

        document.addEventListener("pointermove", handlePointerMove)
        document.addEventListener("pointerleave", handlePointerLeave)

        return () => {
            if (idleTimeout) clearTimeout(idleTimeout)
            document.removeEventListener("pointermove", handlePointerMove)
            document.removeEventListener("pointerleave", handlePointerLeave)
        }
    }, [awareness, connected])

    // 2. Subscribe to awareness state changes (other people's cursors)
    useEffect(() => {
        if (!awareness) return

        const handleAwarenessUpdate = () => {
            const statesMap = awareness.getStates() as Map<number, any>
            const localClientId = awareness.clientID

            const otherUsers: any[] = []
            statesMap.forEach((state, clientId) => {
                if (clientId !== localClientId) {
                    otherUsers.push({
                        clientId,
                        ...state
                    })
                }
            })

            setOthers(otherUsers)
        }

        awareness.on("change", handleAwarenessUpdate)
        
        // Initial load sync
        handleAwarenessUpdate()

        return () => {
            awareness.off("change", handleAwarenessUpdate)
        }
    }, [awareness])

    if (!connected || others.length === 0) return null

    return (
        <div 
            className="pointer-events-none absolute top-0 left-0 w-full z-[9999] overflow-hidden" 
            style={{ height: "max(100vh, 100%)" }}
        >
            <AnimatePresence>
                {others.map(other => {
                    if (!other.cursor) return null

                    return (
                        <motion.div
                            key={other.clientId}
                            className="absolute top-0 left-0 flex flex-col items-start drop-shadow-md"
                            initial={{ opacity: 0, x: other.cursor.x, y: other.cursor.y }}
                            animate={{
                                opacity: 1,
                                x: other.cursor.x,
                                y: other.cursor.y,
                            }}
                            exit={{ opacity: 0 }}
                            transition={{
                                type: "spring",
                                damping: 40,
                                mass: 0.5,
                                stiffness: 400
                            }}
                        >
                            <svg 
                                width="20" 
                                height="20" 
                                viewBox="0 0 20 20" 
                                fill="none" 
                                xmlns="http://www.w3.org/2000/svg"
                                className="relative drop-shadow"
                                style={{
                                    transform: 'rotate(-5deg)',
                                    transformOrigin: 'top left'
                                }}
                            >
                                <path 
                                    d="M2.5 2.5L18.5 8.5L10.5 11.5L7.5 19.5L2.5 2.5Z" 
                                    fill={other.user?.color || "#5c6ac4"}
                                    stroke="white" 
                                    strokeWidth="1.5"
                                    strokeLinejoin="round" 
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div 
                                className="px-2 py-0.5 mt-1 text-[11px] font-bold text-white rounded-full whitespace-nowrap shadow-sm ml-3"
                                style={{ backgroundColor: other.user?.color || "#5c6ac4" }}
                            >
                                {other.user?.name || "Unknown"}
                            </div>
                        </motion.div>
                    )
                })}
            </AnimatePresence>
        </div>
    )
}
