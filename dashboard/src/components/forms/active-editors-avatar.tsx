"use client"

import React, { useEffect, useState } from "react"
import { useLiveEditor } from "./live-editor-provider"
import { motion, AnimatePresence } from "framer-motion"
import { Users } from "lucide-react"

export function ActiveEditorsAvatar() {
    const { awareness, connected } = useLiveEditor()
    const [editors, setEditors] = useState<any[]>([])

    useEffect(() => {
        if (!awareness) return

        const updateEditors = () => {
            const statesMap = awareness.getStates() as Map<number, any>
            
            // Map states into unique users (sometimes people have multiple tabs open)
            const uniqueUsers = new Map()
            
            statesMap.forEach((state, clientId) => {
                if (state.user) {
                    uniqueUsers.set(state.user.id, {
                        ...state.user,
                        clientId // track one connected tab
                    })
                }
            })

            setEditors(Array.from(uniqueUsers.values()))
        }

        awareness.on("change", updateEditors)
        updateEditors()

        return () => {
            awareness.off("change", updateEditors)
        }
    }, [awareness])

    if (!connected) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                Offline
            </div>
        )
    }

    return (
        <div className="flex items-center gap-3 bg-[#222] border border-[#333] rounded-full px-3 py-1.5 hover:bg-[#2a2a2a] transition-colors cursor-default">
            <div className="flex items-center gap-2 border-r border-[#444] pr-3 mr-1">
                <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </div>
                <Users className="h-3.5 w-3.5 text-zinc-400" />
                <span className="text-xs font-bold text-zinc-300">{editors.length} Active</span>
            </div>

            <div className="flex -space-x-2">
                <AnimatePresence>
                    {editors.slice(0, 5).map((editor, i) => (
                        <motion.div
                            key={editor.id}
                            initial={{ opacity: 0, scale: 0.5, x: 10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.5, x: -10 }}
                            className="relative"
                            style={{ zIndex: 10 - i }}
                            title={editor.name}
                        >
                            {editor.imageUrl ? (
                                <img 
                                    src={editor.imageUrl} 
                                    alt={editor.name}
                                    className="h-6 w-6 rounded-full object-cover ring-2 ring-[#222]" 
                                />
                            ) : (
                                <div 
                                    className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-[#222]"
                                    style={{ backgroundColor: editor.color || "#5c6ac4" }}
                                >
                                    {editor.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
                {editors.length > 5 && (
                    <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 ring-2 ring-[#222] z-0">
                        +{editors.length - 5}
                    </div>
                )}
            </div>
        </div>
    )
}
