"use client"

import { useState, useEffect, useRef } from "react"
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react"

interface DiscordRole {
    id: string
    name: string
    color: number
    position: number
}

interface RoleComboboxProps {
    serverId: string
    value?: string | null
    onChange: (roleId: string | null) => void
    placeholder?: string
}

export function RoleCombobox({ serverId, value, onChange, placeholder = "Select a role..." }: RoleComboboxProps) {
    const [open, setOpen] = useState(false)
    const [roles, setRoles] = useState<DiscordRole[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState("")
    const [initialized, setInitialized] = useState(false)

    const containerRef = useRef<HTMLDivElement>(null)

    // Load roles on mount (or first open if we wanted lazy, but mount is safer for displaying initial value)
    useEffect(() => {
        const fetchRoles = async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/discord/roles?serverId=${serverId}`)
                if (res.ok) {
                    const data = await res.json()
                    // Filter out @everyone if you want, or keep it. Usually @everyone is id=guildId
                    setRoles(data)
                }
            } catch (e) {
                console.error("Failed to load roles", e)
            } finally {
                setLoading(false)
                setInitialized(true)
            }
        }

        if (!initialized) {
            fetchRoles()
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

    const selectedRole = roles.find(r => r.id === value)

    // Convert int color to hex
    const getHexColor = (color: number) => {
        if (!color) return "#999"
        return "#" + color.toString(16).padStart(6, '0')
    }

    const filteredRoles = roles.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase())
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
                    selectedRole ? (
                        <span className="flex items-center gap-2">
                            <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: getHexColor(selectedRole.color) }}
                            />
                            <span className="text-white">{selectedRole.name}</span>
                        </span>
                    ) : (
                        <span className="text-zinc-400 font-mono text-xs">{value} (Unknown Role)</span>
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
                                placeholder="Search roles..."
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
                        ) : filteredRoles.length === 0 ? (
                            <div className="p-2 text-center text-xs text-zinc-600">No roles found</div>
                        ) : (
                            filteredRoles.map(role => (
                                <button
                                    key={role.id}
                                    type="button"
                                    role="option"
                                    aria-selected={value === role.id}
                                    onClick={() => {
                                        onChange(role.id)
                                        setOpen(false)
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:bg-white/10 ${value === role.id ? 'bg-white/5' : ''}`}
                                >
                                    <span className="flex items-center gap-2">
                                        <span
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: getHexColor(role.color) }}
                                        />
                                        <span className={`truncate ${value === role.id ? 'text-white font-medium' : 'text-zinc-300'}`}>
                                            {role.name}
                                        </span>
                                    </span>
                                    {value === role.id && <Check className="h-3 w-3 text-emerald-500" />}
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
