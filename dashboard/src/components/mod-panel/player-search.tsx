"use client"


import { Search, User as UserIcon } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { ParsedPlayer } from "./player-list"

export function PlayerSearch({ serverId, onlinePlayers = [] }: { serverId: string, onlinePlayers?: ParsedPlayer[] }) {
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<any[]>([])
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    useEffect(() => {
        const fetchResults = async () => {
            if (query.length < 2) {
                setResults([])
                return
            }

            // 1. Filter online players locally
            const onlineMatches = onlinePlayers.filter(p =>
                p.name.toLowerCase().includes(query.toLowerCase())
            ).map(p => ({ ...p, source: "Online", online: true }))

            // If query is short, just show online matches to be fast
            if (query.length < 3) {
                setResults(onlineMatches)
                setOpen(true)
                return
            }

            try {
                // 2. Fetch remote results (Logs + Roblox)
                const res = await fetch(`/api/players/search?serverId=${serverId}&query=${encodeURIComponent(query)}`)
                if (res.ok) {
                    const data = await res.json()

                    // Filter out duplicates that are already in onlineMatches
                    const remoteResults = data.filter((r: any) =>
                        !onlineMatches.some(om => om.name.toLowerCase() === r.name.toLowerCase())
                    )

                    setResults([...onlineMatches, ...remoteResults])
                    setOpen(true)
                } else {
                    setResults(onlineMatches)
                    setOpen(true)
                }
            } catch (e) {
                console.error(e)
                setResults(onlineMatches)
                setOpen(true)
            }
        }

        const timer = setTimeout(fetchResults, 300)
        return () => clearTimeout(timer)
    }, [query, serverId, onlinePlayers])

    // Click outside to close
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [])

    const handleSelect = (name: string) => {
        setQuery(name)
        setOpen(false)
        router.push(`/dashboard/${serverId}/user/${name}`)
    }

    return (
        <div className="relative w-full" ref={containerRef}>
            <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && query.length >= 3) {
                            handleSelect(query)
                        }
                    }}
                    onFocus={() => query.length >= 2 && setOpen(true)}
                    placeholder="Search player..."
                    className="w-full rounded-lg bg-black/40 border border-[#333] pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
            </div>

            {open && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-[#222] border border-[#333] shadow-xl z-50 overflow-hidden">
                    {results.map((r, i) => (
                        <button
                            key={i}
                            onClick={() => handleSelect(r.name)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#2a2a2a] transition-colors border-b border-[#333] last:border-0"
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                                    {r.avatar ? (
                                        <img src={r.avatar} alt={r.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <UserIcon className="h-4 w-4 text-zinc-400" />
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-sm text-white">{r.displayName || r.name}</p>
                                        {r.source && (
                                            <span className={`text-[10px] px-1.5 rounded ${r.source === "Online" ? "bg-emerald-500/20 text-emerald-400" :
                                                    r.source === "Recent Activity" ? "bg-amber-500/20 text-amber-400" :
                                                        "bg-zinc-700/50 text-zinc-400"
                                                }`}>
                                                {r.source}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-500">@{r.name}</p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
