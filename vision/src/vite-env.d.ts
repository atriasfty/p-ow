/// <reference types="vite/client" />

interface CaptureResult {
    image: string | null
    cursorX: number
    cursorY: number
}

interface ElectronAPI {
    captureScreen: () => Promise<CaptureResult>
    getSettings: () => Promise<{ hotkey: string; toggleHotkey: string; overlayOpacity: number }>
    setSettings: (settings: { hotkey?: string; toggleHotkey?: string; overlayOpacity?: number }) => Promise<boolean>
    storeAuthToken: (token: string) => Promise<boolean>
    getAuthToken: () => Promise<string | null>
    clearAuthToken: () => Promise<boolean>
    onTriggerCapture: (callback: () => void) => () => void
    moveWindow: (x: number, y: number) => void
    openExternal: (url: string) => Promise<void>
    generateSignature: (request?: { method?: string; path?: string; body?: string }) => Promise<string>
    hideOverlay: () => Promise<boolean>
}

declare global {
    interface Window {
        electronAPI: ElectronAPI
    }
}

export { }
