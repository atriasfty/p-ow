import { useState } from 'react'
import logo from '../assets/logo.png'

const API_BASE = 'https://pow.atriasafety.org'

interface LoginScreenProps {
    onLoginSuccess: (user: any) => void
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [showTokenInput, setShowTokenInput] = useState(false)
    const [tokenInput, setTokenInput] = useState('')
    const [error, setError] = useState<string | null>(null)

    const handleOpenBrowser = async () => {
        setIsLoading(true)
        setError(null)

        try {
            // Generate HMAC signature for verification (no body)
            const signature = await window.electronAPI.generateSignature({
                method: 'POST',
                path: '/api/vision/handshake',
                body: ''
            })

            // Get a one-time handshake code from the API
            const res = await fetch(`${API_BASE}/api/vision/handshake`, {
                method: 'POST',
                headers: {
                    'X-Vision-Sig': signature
                }
            })

            if (!res.ok) {
                setError('Failed to connect to POW servers.')
                setIsLoading(false)
                return
            }

            const { code } = await res.json()

            // Open browser with the one-time code
            window.electronAPI.openExternal(`${API_BASE}/vision-auth?code=${code}`)
            setShowTokenInput(true)
        } catch (e) {
            setError('Connection failed. Check your internet connection.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubmitToken = async () => {
        if (!tokenInput.trim()) {
            setError('Please enter your token')
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const authBody = JSON.stringify({ token: tokenInput.trim() })

            const signature = await window.electronAPI.generateSignature({
                method: 'POST',
                path: '/api/vision/auth',
                body: authBody
            })

            // Verify the token with the API
            const res = await fetch(`${API_BASE}/api/vision/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Vision-Sig': signature
                },
                body: authBody
            })

            if (res.ok) {
                const data = await res.json()
                if (data.valid) {
                    await window.electronAPI.storeAuthToken(tokenInput.trim())
                    onLoginSuccess(data.user)
                } else {
                    setError('Invalid token. Please try again.')
                }
            } else {
                setError('Failed to verify token. Please try again.')
            }
        } catch (e) {
            setError('Connection failed. Check your internet connection.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="w-full h-screen bg-pow-bg/95 rounded-2xl border border-pow-border overflow-hidden flex flex-col items-center justify-center p-8">
            <img src={logo} alt="POW" className="w-16 h-16 mb-6" />

            <h1 className="text-white text-xl font-bold mb-2">POW Vision</h1>
            <p className="text-white/50 text-sm text-center mb-6">
                Connect your POW account to get started
            </p>

            {error && (
                <div className="w-full max-w-xs bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
            )}

            {!showTokenInput ? (
                <>
                    <button
                        onClick={handleOpenBrowser}
                        className="w-full max-w-xs bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <LockIcon />
                        Login with POW Dashboard
                    </button>
                    <p className="text-white/30 text-xs mt-4 text-center">
                        You'll be redirected to sign in via the POW dashboard
                    </p>
                </>
            ) : (
                <>
                    <p className="text-white/60 text-sm text-center mb-4">
                        After logging in, copy the token and paste it below:
                    </p>
                    <input
                        type="text"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="Paste your token here..."
                        className="w-full max-w-xs bg-pow-card border border-pow-border rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 text-sm mb-3"
                    />
                    <button
                        onClick={handleSubmitToken}
                        disabled={isLoading}
                        className="w-full max-w-xs bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            'Connect'
                        )}
                    </button>
                    <button
                        onClick={() => {
                            setShowTokenInput(false)
                            setTokenInput('')
                            setError(null)
                        }}
                        className="text-white/40 hover:text-white/60 text-sm mt-3"
                    >
                        ← Back
                    </button>
                </>
            )}
        </div>
    )
}

function LockIcon() {
    return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
    )
}
