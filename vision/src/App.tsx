import { useState, useEffect, useCallback } from 'react'
import { PlayerPanel } from './components/PlayerPanel'
import { Settings } from './components/Settings'
import { LoginScreen } from './components/LoginScreen'
import { useOcr } from './hooks/useOcr'
import { initPostHog, identifyUser, resetUser, captureEvent } from './lib/posthog'
import logo from './assets/logo.png'

type View = 'main' | 'settings'

interface PlayerData {
    id: number
    name: string
    displayName: string
    avatar?: string
    created?: string
    online?: boolean
    team?: string
    punishmentCount?: number
    recentPunishments?: Array<{
        id: string
        type: string
        reason: string
        createdAt: string
        resolved: boolean
    }>
}

// Helper to parse JWT payload for analytics (trusting server verification for actual access)
function parseJwt(token: string) {
    try {
        const base64Url = token.split('.')[1]
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        }).join(''))
        return JSON.parse(jsonPayload)
    } catch (e) {
        return null
    }
}

function App() {
    const [view, setView] = useState<View>('main')
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [player, setPlayer] = useState<PlayerData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [scanHotkey, setScanHotkey] = useState('Alt+V')
    const [toggleHotkey, setToggleHotkey] = useState('Alt+Shift+V')
    const { processCapture, isProcessing } = useOcr()

    // Check auth and load settings on mount
    useEffect(() => {
        const init = async () => {
            initPostHog()

            const [token, settings] = await Promise.all([
                window.electronAPI.getAuthToken(),
                window.electronAPI.getSettings()
            ])

            if (token) {
                setIsLoggedIn(true)
                const payload = parseJwt(token)
                if (payload) {
                    identifyUser({
                        userId: payload.userId,
                        username: payload.username,
                        robloxId: payload.robloxId,
                        robloxUsername: payload.robloxUsername,
                        discordId: payload.discordId
                    })
                }
            } else {
                setIsLoggedIn(false)
            }

            setScanHotkey(settings.hotkey)
            setToggleHotkey(settings.toggleHotkey)
            setIsLoading(false)
        }
        init()
    }, [])



    // Listen for capture trigger from hotkey
    useEffect(() => {
        const cleanup = window.electronAPI.onTriggerCapture(async () => {
            setError(null)

            // Capture screen region around cursor
            const captureResult = await window.electronAPI.captureScreen()
            if (!captureResult.image) {
                setError('Failed to capture screen')
                return
            }

            try {
                const detectedName = await processCapture(captureResult.image)
                if (detectedName) {
                    // Move panel near the cursor where username was detected
                    window.electronAPI.moveWindow(captureResult.cursorX, captureResult.cursorY)
                    await lookupPlayer(detectedName)
                } else {
                    setError('No matching player found')
                    captureEvent('vision_player_not_found', { reason: 'ocr_no_match' })
                }
            } catch (err: any) {
                if (err.message === 'Unauthorized') {
                    console.log('Session expired during OCR, logging out...')
                    await window.electronAPI.clearAuthToken()
                    setIsLoggedIn(false)
                    resetUser()
                } else {
                    console.error('Capture processing error:', err)
                    setError('Identification failed')
                }
            }
        })

        return cleanup
    }, [processCapture])

    // Lookup player via POW API
    const lookupPlayer = async (username: string) => {
        try {
            const token = await window.electronAPI.getAuthToken()
            if (!token) {
                setIsLoggedIn(false)
                resetUser()
                return
            }

            const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'https://pow.atriasafety.org'

            // Include the query string in the signed path so the signature covers
            // the specific username being looked up, not just the endpoint.
            const playerPath = `/api/vision/player?username=${encodeURIComponent(username)}`
            const signature = await window.electronAPI.generateSignature({
                method: 'GET',
                path: playerPath,
                body: ''
            })

            const res = await fetch(`${API_BASE}${playerPath}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Vision-Sig': signature
                }
            })

            if (res.ok) {
                const data = await res.json()
                setPlayer(data)
                setError(null)
                captureEvent('vision_player_found', {
                    player_id: data.id,
                    player_name: data.name,
                    player_display_name: data.displayName,
                    has_punishments: (data.punishmentCount || 0) > 0,
                    punishment_count: data.punishmentCount || 0
                })
            } else if (res.status === 401) {
                setIsLoggedIn(false)
                await window.electronAPI.clearAuthToken()
                resetUser()
            } else if (res.status === 404) {
                setError('Player not found')
                captureEvent('vision_player_not_found', { reason: 'api_404', searched_username: username })
            } else {
                setError('Failed to lookup player')
            }
        } catch (e) {
            console.error('Player lookup error:', e)
            setError('Connection failed')
        }
    }

    // Manual search
    const handleSearch = useCallback(async (username: string) => {
        setError(null)
        await lookupPlayer(username)
    }, [])

    const handleLogout = async () => {
        await window.electronAPI.clearAuthToken()
        setIsLoggedIn(false)
        setPlayer(null)
        resetUser()
    }

    const handleLoginSuccess = (user?: any) => {
        setIsLoggedIn(true)
        if (user) {
            identifyUser({
                userId: user.userId || user.id,
                username: user.username,
                robloxId: user.robloxId,
                robloxUsername: user.robloxUsername,
                discordId: user.discordId,
                name: user.name,
                image: user.image
            })
        }
    }

    const handleHotkeyChange = (newScanHotkey: string, newToggleHotkey: string) => {
        setScanHotkey(newScanHotkey)
        setToggleHotkey(newToggleHotkey)
    }

    if (isLoading) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-pow-bg/95 rounded-2xl">
                <div className="text-white/50">Loading...</div>
            </div>
        )
    }

    if (!isLoggedIn) {
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />
    }

    return (
        <div className="w-full h-screen bg-pow-bg/95 rounded-2xl border border-pow-border overflow-hidden flex flex-col">
            {/* Header - Draggable */}
            <header className="drag-region flex items-center justify-between p-3 border-b border-pow-border bg-pow-card/50">
                <div className="flex items-center gap-2">
                    <img src={logo} alt="POW" className="w-6 h-6 object-contain" />
                    <span className="text-white font-semibold text-sm">POW Vision</span>
                </div>
                <div className="no-drag flex items-center gap-1">
                    <button
                        onClick={() => setView(view === 'main' ? 'settings' : 'main')}
                        className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        title="Settings"
                    >
                        <SettingsIcon />
                    </button>
                    <button
                        onClick={() => window.electronAPI.hideOverlay()}
                        className="p-1.5 rounded hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
                        title="Hide overlay (use hotkey or tray icon to show)"
                    >
                        <CloseIcon />
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-hidden">
                {view === 'settings' ? (
                    <Settings
                        onBack={() => setView('main')}
                        onLogout={handleLogout}
                        onHotkeyChange={handleHotkeyChange}
                    />
                ) : (
                    <PlayerPanel
                        player={player}
                        isProcessing={isProcessing}
                        error={error}
                        onSearch={handleSearch}
                        onClear={() => setPlayer(null)}
                        scanHotkey={scanHotkey}
                    />
                )}
            </main>

            {/* Footer */}
            <footer className="p-2 border-t border-pow-border text-center">
                <span className="text-white/30 text-xs">
                    Press <kbd className="bg-pow-card px-1 py-0.5 rounded text-white/50">{scanHotkey}</kbd> to scan • <kbd className="bg-pow-card px-1 py-0.5 rounded text-white/50">{toggleHotkey}</kbd> to toggle
                </span>
            </footer>
        </div>
    )
}

function SettingsIcon() {
    return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    )
}

function CloseIcon() {
    return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
    )
}

export default App
