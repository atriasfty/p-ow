"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Server, Key, CheckCircle, Search, LogIn, Plus, ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface EligibleGuild {
    id: string
    name: string
    icon: string | null
    hasBot: boolean
    hasPowServer: boolean
}

export function ServerCreationWizard() {
    const router = useRouter()

    const [step, setStep] = useState<1 | 2 | 3>(1)

    // Form state
    const [prcApiKey, setPrcApiKey] = useState("")
    const [discordGuildId, setDiscordGuildId] = useState("")

    // Status state
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [validationResult, setValidationResult] = useState<{
        prcValid: boolean;
        serverName: string;
        botInGuild: boolean;
        guildName: string;
        availableChannels: { id: string, name: string }[];
        availableRoles: { id: string, name: string, color: number }[];
    } | null>(null)

    // Initial Config state
    const [config, setConfig] = useState({
        adminRoleId: "",
        staffRoleId: "",
        logChannelId: ""
    })

    // Guilds state
    const [guilds, setGuilds] = useState<EligibleGuild[]>([])
    const [loadingGuilds, setLoadingGuilds] = useState(true)

    useEffect(() => {
        const fetchGuilds = async () => {
            try {
                const res = await fetch("/api/discord/eligible-guilds")
                if (res.ok) {
                    const data = await res.json()
                    setGuilds(data)
                }
            } catch (e) {
                console.error("Failed to fetch guilds", e)
            } finally {
                setLoadingGuilds(false)
            }
        }
        fetchGuilds()
    }, [])

    // Handle verifying PRC Key and Discord Guild
    const handleVerify = async () => {
        if (!prcApiKey || !discordGuildId) {
            setError("Both PRC API Key and Discord Guild ID are required.")
            return
        }

        setLoading(true)
        setError(null)

        try {
            const res = await fetch("/api/admin/server/verify-creation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prcApiKey, discordGuildId })
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || "Verification failed.")
                setLoading(false)
                return
            }

            setValidationResult(data)

            if (data.prcValid && data.botInGuild) {
                setStep(2)
            } else {
                setError("Please ensure the API key is valid and the POW Discord Bot is invited to your server.")
            }

        } catch (e: any) {
            setError(e.message || "An unknown error occurred.")
        } finally {
            setLoading(false)
        }
    }

    // Handle final creation
    const handleCreate = async () => {
        if (!config.adminRoleId || !config.staffRoleId || !config.logChannelId) {
            setError("Please complete all configuration fields.")
            return
        }

        setLoading(true)
        setError(null)

        try {
            const res = await fetch("/api/admin/server/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    prcApiKey, 
                    discordGuildId,
                    initialConfig: config
                })
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || "Creation failed.")
                setLoading(false)
                return
            }

            setStep(3)

            // Redirect after 3s
            setTimeout(() => {
                router.push(`/dashboard/${data.serverId}/admin`)
            }, 3000)

        } catch (e: any) {
            setError(e.message || "An unknown error occurred.")
            setLoading(false)
        }
    }

    return (
        <div className="space-y-8">
            {/* Step Indicators */}
            <div className="flex items-center justify-between relative mb-8">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-zinc-800 rounded-full z-0"></div>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 rounded-full z-0 transition-all duration-500" style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}></div>

                <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full font-bold shadow-lg transition-colors ${step >= 1 ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>1</div>
                <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full font-bold shadow-lg transition-colors ${step >= 2 ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>2</div>
                <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full font-bold shadow-lg transition-colors ${step >= 3 ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>3</div>
            </div>

            {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Step 1: Input */}
            {step === 1 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">PRC API Key</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                                <Input
                                    className="pl-11 bg-zinc-900 border-zinc-800 h-12"
                                    placeholder="Enter your ERLC server API key..."
                                    value={prcApiKey}
                                    onChange={(e) => setPrcApiKey(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                            <p className="text-xs text-zinc-500">Found in ERLC Server Settings → API</p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-zinc-300">Select Discord Guild</label>
                                <a 
                                    href="https://discord.com/oauth2/authorize?client_id=1449823310383939725&permissions=8&integration_type=0&scope=bot" 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                >
                                    Invite Bot <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>

                            {loadingGuilds ? (
                                <div className="h-12 border border-zinc-800 bg-zinc-900 rounded-md flex items-center justify-center">
                                    <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                                </div>
                            ) : guilds.length === 0 ? (
                                <div className="p-4 border border-zinc-800 bg-zinc-900 rounded-md text-sm text-zinc-400 text-center">
                                    No eligible Discord servers found. You must have Administrator or Manage Server permissions.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                    {guilds.map((g) => {
                                        const isSelected = discordGuildId === g.id
                                        const isAvailable = g.hasBot && !g.hasPowServer
                                        
                                        return (
                                            <div 
                                                key={g.id}
                                                onClick={() => isAvailable && setDiscordGuildId(g.id)}
                                                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                                    !isAvailable ? 'opacity-50 border-zinc-800 bg-zinc-900/50 cursor-not-allowed' :
                                                    isSelected ? 'border-emerald-500 bg-emerald-500/10 cursor-pointer' : 
                                                    'border-zinc-800 bg-zinc-900 hover:bg-zinc-800 cursor-pointer'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {g.icon ? (
                                                        <img src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`} className="h-8 w-8 rounded-full" />
                                                    ) : (
                                                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium">
                                                            {g.name.substring(0, 2)}
                                                        </div>
                                                    )}
                                                    <span className="text-sm font-medium text-white">{g.name}</span>
                                                </div>
                                                
                                                <div className="text-xs">
                                                    {g.hasPowServer ? (
                                                        <span className="text-zinc-500">Already Linked</span>
                                                    ) : !g.hasBot ? (
                                                        <a 
                                                            href={`https://discord.com/oauth2/authorize?client_id=1449823310383939725&permissions=8&integration_type=0&scope=bot&guild_id=${g.id}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-indigo-400 hover:text-indigo-300"
                                                            onClick={(e) => e.stopPropagation()} // Prevent selecting row when clicking link
                                                        >
                                                            Invite Bot
                                                        </a>
                                                    ) : isSelected ? (
                                                        <span className="text-emerald-500 font-medium">Selected</span>
                                                    ) : (
                                                        <span className="text-zinc-400">Available</span>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button
                            className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-lg"
                            onClick={handleVerify}
                            disabled={loading || !discordGuildId || !prcApiKey}
                        >
                            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Verify & Continue"}
                        </Button>
                    </div>
                </div>
            )}

            {/* Step 2: Configuration */}
            {step === 2 && validationResult && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="text-center">
                        <h3 className="text-xl font-bold text-white">Initial Configuration</h3>
                        <p className="text-sm text-zinc-500 mt-1">Link your Discord roles and channels to get started.</p>
                    </div>

                    <div className="space-y-4">
                        {/* Admin Role */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Dashboard Admin Role</label>
                            <div className="relative">
                                <select 
                                    value={config.adminRoleId}
                                    onChange={(e) => setConfig({ ...config, adminRoleId: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                                >
                                    <option value="">Select Admin Role...</option>
                                    {validationResult.availableRoles.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-[10px] text-zinc-500">Members with this role will have full access to this dashboard.</p>
                        </div>

                        {/* Staff Role */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">General Staff Role</label>
                            <div className="relative">
                                <select 
                                    value={config.staffRoleId}
                                    onChange={(e) => setConfig({ ...config, staffRoleId: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                                >
                                    <option value="">Select Staff Role...</option>
                                    {validationResult.availableRoles.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-[10px] text-zinc-500">The primary staff role in your Discord. Used for shift tracking.</p>
                        </div>

                        {/* Log Channel */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">System Logs Channel</label>
                            <div className="relative">
                                <select 
                                    value={config.logChannelId}
                                    onChange={(e) => setConfig({ ...config, logChannelId: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                                >
                                    <option value="">Select Channel...</option>
                                    {validationResult.availableChannels.map(c => (
                                        <option key={c.id} value={c.id}># {c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-[10px] text-zinc-500">Where the bot will send moderation and system logs.</p>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-4">
                        <Button
                            variant="outline"
                            className="w-1/3 h-12 bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                            onClick={() => setStep(1)}
                            disabled={loading}
                        >
                            Back
                        </Button>
                        <Button
                            className="w-2/3 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-lg"
                            onClick={handleCreate}
                            disabled={loading || !config.adminRoleId || !config.staffRoleId || !config.logChannelId}
                        >
                            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Deploy & Finish"}
                        </Button>
                    </div>
                </div>
            )}

            {/* Step 3: Success */}
            {step === 3 && (
                <div className="py-12 flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95 duration-500">
                    <div className="h-24 w-24 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
                        <CheckCircle className="h-12 w-12 text-emerald-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-white text-center">Server Deployed!</h3>
                    <p className="text-zinc-400 text-center max-w-sm">
                        Your Project Overwatch command center is ready. Redirecting you to the dashboard...
                    </p>
                    <Loader2 className="animate-spin h-6 w-6 text-emerald-500 mt-4" />
                </div>
            )}

        </div>
    )
}
