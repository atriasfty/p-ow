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

        // 1. Create the shared Yjs document
        const ydoc = new Y.Doc()

        // 2. Connect to our localized WebSocket server via the Cloudflare Tunnel
        // The room name is strictly bound to the formId
        const wsProvider = new WebsocketProvider(
            "wss://powsync.ciankelly.xyz",
            `form-room-${formId}`,
            ydoc
        )

        // 3. Set up the Awareness protocol (for cursors & presence)
        const awareness = wsProvider.awareness

        // Inject the current user into the awareness state
        awareness.setLocalStateField("user", {
            id: user.id,
            name: user.username || user.firstName || "Unknown Admin",
            imageUrl: user.imageUrl,
            color: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
            cursor: null // { x, y } will be updated by listeners
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

        return () => {
            wsProvider.disconnect()
            wsProvider.destroy()
            ydoc.destroy()
        }
    }, [formId, user])

    return (
        <LiveEditorContext.Provider value={contextValue}>
            {children}
        </LiveEditorContext.Provider>
    )
}
