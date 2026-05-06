"use client"

import type { ReactNode } from "react"

function Bone({ className }: { className?: string }) {
    return (
        <div className={`bg-white/5 rounded-lg animate-pulse ${className ?? ""}`} />
    )
}

function SkeletonCard({ children, className }: { children?: ReactNode; className?: string }) {
    return (
        <div className={`rounded-xl bg-[#1a1a1a] border border-[#333] p-4 ${className ?? ""}`}>
            {children}
        </div>
    )
}

export function ModPanelSkeleton() {
    return (
        <div className="hidden md:flex flex-col h-screen bg-[#111] text-zinc-100 font-sans overflow-hidden">
            {/* Header */}
            <div className="flex h-16 items-center justify-between border-b border-white/5 bg-[#1a1a1a] px-6 rounded-t-xl mb-4 flex-shrink-0 mx-4 mt-4">
                <div className="flex items-center gap-3">
                    <Bone className="h-8 w-8 rounded-full flex-shrink-0" />
                    <div className="space-y-2">
                        <Bone className="h-3 w-32" />
                        <Bone className="h-2.5 w-20" />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Bone className="h-8 w-28 rounded-lg" />
                    <Bone className="h-8 w-24 rounded-lg" />
                    <Bone className="h-8 w-32 rounded-lg" />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 xl:grid-cols-5 flex-1 min-h-0 px-4 pb-4">
                {/* LEFT COLUMN */}
                <div className="lg:col-span-1 flex flex-col gap-4 h-full min-h-0">
                    {/* Shift button */}
                    <SkeletonCard className="flex-shrink-0 space-y-3">
                        <Bone className="h-10 w-full rounded-lg" />
                        <Bone className="h-3 w-3/4 mx-auto" />
                        <div className="border-t border-white/5 pt-3 space-y-2">
                            <div className="flex justify-between">
                                <Bone className="h-2.5 w-20" />
                                <Bone className="h-2.5 w-16" />
                            </div>
                            <Bone className="h-2 w-full rounded-full" />
                        </div>
                    </SkeletonCard>

                    {/* Player list */}
                    <SkeletonCard className="flex-1 flex flex-col gap-3 overflow-hidden">
                        <div className="flex justify-between items-center flex-shrink-0">
                            <Bone className="h-4 w-20" />
                            <Bone className="h-3 w-3 rounded-full" />
                        </div>
                        <Bone className="h-7 w-full rounded-lg flex-shrink-0" />
                        <div className="flex flex-col gap-2 overflow-hidden">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <Bone className="h-6 w-6 rounded-full flex-shrink-0" />
                                    <Bone className="h-3 flex-1" />
                                </div>
                            ))}
                        </div>
                    </SkeletonCard>
                </div>

                {/* MIDDLE COLUMN */}
                <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-4 h-full min-h-0">
                    {/* Toolbox bar */}
                    <SkeletonCard className="flex-shrink-0">
                        <div className="flex gap-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Bone key={i} className="h-9 w-24 rounded-lg" />
                            ))}
                        </div>
                    </SkeletonCard>

                    {/* Logs panel */}
                    <SkeletonCard className="flex-1 flex flex-col gap-3 overflow-hidden">
                        <div className="flex-shrink-0 border-b border-[#2a2a2a] pb-3">
                            <Bone className="h-4 w-20" />
                        </div>
                        <div className="flex flex-col gap-2.5 overflow-hidden">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <Bone className="h-2.5 w-16 flex-shrink-0" />
                                    <Bone className="h-2.5 flex-1" />
                                </div>
                            ))}
                        </div>
                    </SkeletonCard>
                </div>

                {/* RIGHT COLUMN */}
                <div className="lg:col-span-1 flex flex-col h-full min-h-0 bg-[#1a1a1a] rounded-xl overflow-hidden border border-[#222]">
                    <div className="p-4 border-b border-[#2a2a2a] flex-shrink-0">
                        <Bone className="h-4 w-28" />
                    </div>
                    <div className="flex flex-col gap-3 p-4 overflow-hidden">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <Bone className="h-5 w-16 rounded-full flex-shrink-0" />
                                    <Bone className="h-2.5 flex-1" />
                                </div>
                                <Bone className="h-2 w-3/4 ml-[4.5rem]" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
