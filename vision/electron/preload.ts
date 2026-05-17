import { contextBridge, ipcRenderer } from 'electron'

interface CaptureResult {
    image: string | null
    cursorX: number
    cursorY: number
}

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // Screen capture
    captureScreen: () => ipcRenderer.invoke('capture-screen'),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    setSettings: (settings: { hotkey?: string; toggleHotkey?: string; overlayOpacity?: number }) =>
        ipcRenderer.invoke('set-settings', settings),

    // Auth
    storeAuthToken: (token: string) => ipcRenderer.invoke('store-auth-token', token),
    getAuthToken: () => ipcRenderer.invoke('get-auth-token'),
    clearAuthToken: () => ipcRenderer.invoke('clear-auth-token'),

    // Generate HMAC signature for an API request. Pass method/path/body so the
    // signature is bound to a specific request and cannot be replayed elsewhere.
    generateSignature: (request?: { method?: string; path?: string; body?: string }) =>
        ipcRenderer.invoke('generate-signature', request),

    // Listen for capture trigger from main process
    onTriggerCapture: (callback: () => void) => {
        ipcRenderer.on('trigger-capture', callback)
        return () => ipcRenderer.removeListener('trigger-capture', callback)
    },

    // Move window to position (for positioning near detected username)
    moveWindow: (x: number, y: number) => ipcRenderer.send('move-window', x, y),

    // Open URL in system default browser
    openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

    // Hide the overlay (for X button)
    hideOverlay: () => ipcRenderer.invoke('hide-overlay')
})

// Type definitions for renderer
export interface ElectronAPI {
    captureScreen: () => Promise<CaptureResult>
    getSettings: () => Promise<{ hotkey: string; toggleHotkey: string; overlayOpacity: number }>
    setSettings: (settings: { hotkey?: string; toggleHotkey?: string; overlayOpacity?: number }) => Promise<boolean>
    storeAuthToken: (token: string) => Promise<boolean>
    getAuthToken: () => Promise<string | null>
    clearAuthToken: () => Promise<boolean>
    generateSignature: (request?: { method?: string; path?: string; body?: string }) => Promise<string>
    onTriggerCapture: (callback: () => void) => () => void
    moveWindow: (x: number, y: number) => void
    openExternal: (url: string) => Promise<void>
    hideOverlay: () => Promise<boolean>
}

declare global {
    interface Window {
        electronAPI: ElectronAPI
    }
}

