"use client"

import { useState, useEffect, useRef } from "react"
import { Check, ChevronsUpDown, Loader2, Search, Hash } from "lucide-react"

interface DiscordChannel {
    id: string
    name: string
    parentId: string | null
}

interface ChannelComboboxProps {
    serverId: string
    value?: string | null
    onChange: (channelId: string | null) => void
    placeholder?: string
}

export function ChannelCombobox({ serverId, value, onChange, placeholder = "Select a channel..." }: ChannelComboboxProps) {
    const [open, setOpen] = useState(false)
    const [channels, setChannels] = useState<DiscordChannel[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState("")
    const [initialized, setInitialized] = useState(false)

    const containerRef = useRef<HTMLDivElement>(null)

    // Load channels on mount
    useEffect(() => {
        const fetchChannels = async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/discord/channels?serverId=${serverId}`)
                if (res.ok) {
                    const data = await res.json()
                    setChannels(data)
                }
            } catch (e) {
                console.error("Failed to load channels", e)
            } finally {
                setLoading(false)
                setInitialized(true)
            }
        }

        if (!initialized) {
            fetchChannels()
        }
    }, [serverId, initialized])

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const selectedChannel = channels.find(c => c.id === value)

    const filteredChannels = channels.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="w-full flex items-center justify-between bg-[#222] border border-[#333] hover:border-[#444] rounded-lg px-3 py-2 text-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
                {value ? (
                    selectedChannel ? (
                        <span className="flex items-center gap-2">
                            <Hash className="w-3 h-3 text-zinc-500" />
                            <span className="text-white">{selectedChannel.name}</span>
                        </span>
                    ) : (
                        <span className="text-zinc-400 font-mono text-xs">{value} (Unknown Channel)</span>
                    )
                ) : (
                    <span className="text-zinc-500">{placeholder}</span>
                )}
                <ChevronsUpDown className="h-4 w-4 text-zinc-500" />
            </button>

            {open && (
                <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-[#2a2a2a]">
                        <div className="flex items-center gap-2 bg-[#222] rounded px-2 py-1.5">
                            <Search className="h-3 w-3 text-zinc-500" />
                            <input
                                className="bg-transparent border-0 outline-none text-xs text-white placeholder-zinc-600 w-full"
                                placeholder="Search channels..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto" role="listbox">
                        {loading ? (
                            <div className="p-4 flex justify-center text-zinc-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                        ) : filteredChannels.length === 0 ? (
                            <div className="p-2 text-center text-xs text-zinc-600">No channels found</div>
                        ) : (
                            filteredChannels.map(channel => (
                                <button
                                    key={channel.id}
                                    type="button"
                                    role="option"
                                    aria-selected={value === channel.id}
                                    onClick={() => {
                                        onChange(channel.id)
                                        setOpen(false)
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:bg-white/10 ${value === channel.id ? 'bg-white/5' : ''}`}
                                >
                                    <span className="flex items-center gap-2">
                                        <Hash className="w-3 h-3 text-zinc-500" />
                                        <span className={`truncate ${value === channel.id ? 'text-white font-medium' : 'text-zinc-300'}`}>
                                            {channel.name}
                                        </span>
                                    </span>
                                    {value === channel.id && <Check className="h-3 w-3 text-emerald-500" />}
                                </button>
                            ))
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                onChange(null)
                                setOpen(false)
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border-t border-[#2a2a2a]"
                        >
                            Clear Selection
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
