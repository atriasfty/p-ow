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

        const handlePointerMove = (e: PointerEvent) => {
            // Use absolute page coordinates so scrolling is synced
            const cursor = {
                x: e.pageX,
                y: e.pageY
            }
            awareness.setLocalStateField("cursor", cursor)
        }

        const handlePointerLeave = () => {
            awareness.setLocalStateField("cursor", null) // hide cursor
        }

        document.addEventListener("pointermove", handlePointerMove)
        document.addEventListener("pointerleave", handlePointerLeave)

        return () => {
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
        <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
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
                                damping: 30,
                                mass: 0.8,
                                stiffness: 300
                            }}
                        >
                            <svg 
                                width="24" 
                                height="36" 
                                viewBox="0 0 24 36" 
                                fill="none" 
                                xmlns="http://www.w3.org/2000/svg"
                                className="relative -top-[2px] -left-[9px]"
                            >
                                <path 
                                    d="M5.65376 2.50085L21.4391 18.2861C22.6105 19.4576 21.849 21.4939 20.1983 21.5976L13.8823 21.9942C13.5684 22.0139 13.2778 22.1587 13.0645 22.4034L8.7904 27.3093C7.69837 28.562 5.56875 27.9157 5.37894 26.2779L3.58509 10.8A3.08051 3.08051 0 015.65376 2.50085Z" 
                                    fill={other.user?.color || "#5c6ac4"}
                                    stroke="white" 
                                    strokeWidth="2"
                                />
                            </svg>
                            <div 
                                className="px-2 py-0.5 mt-1 text-[10px] font-bold text-white rounded-full whitespace-nowrap"
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
