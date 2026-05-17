"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import * as Y from "yjs"
// @ts-ignore
import { WebsocketProvider } from "y-websocket"
import { useUser } from "@clerk/nextjs"

interface LiveEditorContextType {
    doc: Y.Doc | null
    provider: WebsocketProvider | null
    awareness: any | null
    connected: boolean
}

const LiveEditorContext = createContext<LiveEditorContextType>({
    doc: null,
    provider: null,
    awareness: null,
    connected: false,
})

export function useLiveEditor() {
    return useContext(LiveEditorContext)
}

export function LiveEditorProvider({
    formId,
    children
}: {
    formId: string
    children: React.ReactNode
}) {
    const { user } = useUser()
    const [contextValue, setContextValue] = useState<LiveEditorContextType>({
        doc: null,
        provider: null,
        awareness: null,
        connected: false
    })

    useEffect(() => {
        if (!user || !formId) return

        let cancelled = false
        let wsProvider: WebsocketProvider | null = null
        let ydoc: Y.Doc | null = null

        ;(async () => {
            // 1. Get a per-document JWT — the server validates form access
            //    before issuing it. Replaces the previous global shared
            //    NEXT_PUBLIC_SYNC_WS_SECRET that any client could read.
            let token: string
            let room: string
            try {
                const res = await fetch(`/api/forms/${formId}/sync-token`, {
                    credentials: "include"
                })
                if (!res.ok) {
                    console.warn("[LiveEditor] sync-token denied:", res.status)
                    return
                }
                const json = await res.json()
                token = json.token
                room = json.room
            } catch (e) {
                console.error("[LiveEditor] sync-token fetch failed:", e)
                return
            }

            if (cancelled) return

            ydoc = new Y.Doc()

            const syncUrl = process.env.NEXT_PUBLIC_SYNC_URL || "wss://powsync.ciankelly.xyz"
            wsProvider = new WebsocketProvider(
                syncUrl,
                room,
                ydoc,
                { params: { token } }
            )

            const awareness = wsProvider.awareness

            awareness.setLocalStateField("user", {
                id: user.id,
                name: user.username || user.firstName || "Unknown Admin",
                imageUrl: user.imageUrl,
                color: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
                cursor: null
            })

            wsProvider.on('status', (event: { status: string }) => {
                setContextValue(prev => ({ ...prev, connected: event.status === 'connected' }))
            })

            setContextValue({
                doc: ydoc,
                provider: wsProvider,
                awareness,
                connected: wsProvider.wsconnected
            })
        })()

        return () => {
            cancelled = true
            if (wsProvider) {
                wsProvider.disconnect()
                wsProvider.destroy()
            }
            if (ydoc) ydoc.destroy()
        }
    }, [formId, user])

    return (
        <LiveEditorContext.Provider value={contextValue}>
            {children}
        </LiveEditorContext.Provider>
    )
}
