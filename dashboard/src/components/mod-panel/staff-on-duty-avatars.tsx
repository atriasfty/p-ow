"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useServerEventsContext } from "@/components/providers/server-events-provider"

interface StaffMember {
    userId: string
    name: string
    username: string
    robloxUsername: string
    imageUrl: string
    shiftStart: string
}

export function StaffOnDutyAvatars({ serverId, excludeUserId }: { serverId: string, excludeUserId?: string }) {
    const [staff, setStaff] = useState<StaffMember[]>([])
    const [loading, setLoading] = useState(true)
    const { staffOnDutyIds } = useServerEventsContext()

    // When we get updated IDs from SSE, fetch the full staff details
    useEffect(() => {
        if (staffOnDutyIds.length === 0 && !loading) {
            setStaff([])
            return
        }

        // Fetch full staff details from REST (IDs alone aren't enough for display)
        const fetchStaff = async () => {
            try {
                const res = await fetch(`/api/staff/on-duty?serverId=${serverId}`)
                if (res.ok) {
                    const data = await res.json()
                    const filtered = excludeUserId
                        ? data.filter((s: StaffMember) => s.userId !== excludeUserId)
                        : data
                    setStaff(filtered)
                }
            } catch (e) {
                console.error("Failed to fetch on-duty staff", e)
            } finally {
                setLoading(false)
            }
        }

        fetchStaff()
    }, [staffOnDutyIds, serverId, excludeUserId])

    if (loading && staff.length === 0) return null

    return (
        <div className="flex items-center gap-2">
            <span className="text-zinc-500 mx-2">|</span>
            <div className="flex -space-x-2 overflow-hidden items-center group">
                {staff.map((member) => (
                    <Link
                        key={member.userId}
                        href={`/dashboard/${serverId}/user/${encodeURIComponent(member.robloxUsername)}`}
                        className="relative inline-block"
                        title={member.robloxUsername}
                    >
                        <div className="relative group/avatar">
                            <img
                                className="inline-block h-7 w-7 rounded-full ring-2 ring-[#1a1a1a] hover:ring-indigo-500 transition-all cursor-pointer bg-zinc-800"
                                src={member.imageUrl}
                                alt={member.name}
                            />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-[10px] text-white rounded opacity-0 group-hover/avatar:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-white/10 shadow-xl">
                                <p className="font-bold">{member.name}</p>
                                <p className="text-zinc-400">@{member.robloxUsername}</p>
                            </div>
                        </div>
                    </Link>
                ))}
                {staff.length === 0 && (
                    <span className="text-zinc-500 text-xs italic">No other staff on duty</span>
                )}
                {staff.length > 0 && (
                    <span className="text-zinc-400 text-xs ml-3">
                        {staff.length} other staff
                    </span>
                )}
            </div>
        </div>
    )
}
