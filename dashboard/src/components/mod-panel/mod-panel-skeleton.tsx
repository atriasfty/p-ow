"use client"

function Bone({ className }: { className?: string }) {
    return (
        <div className={`bg-white/5 rounded animate-pulse ${className ?? ""}`} />
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
                        <Bone className="h-3 w-36 rounded" />
                        <div className="flex items-center gap-2">
                            <Bone className="h-2 w-2 rounded-full" />
                            <Bone className="h-2.5 w-16 rounded" />
                            <Bone className="h-2.5 w-28 rounded" />
                        </div>
                    </div>
                </div>
                <Bone className="h-8 w-36 rounded-lg" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 xl:grid-cols-5 flex-1 min-h-0 px-4 pb-4">

                {/* LEFT COLUMN */}
                <div className="lg:col-span-1 flex flex-col gap-4 h-full min-h-0">

                    {/* Shift button + quota */}
                    <div className="rounded-xl bg-[#1a1a1a] border border-[#333] p-4 flex-shrink-0 space-y-4">
                        <Bone className="h-10 w-full rounded-lg" />
                        <div className="border-t border-white/5 pt-3 space-y-1.5">
                            <Bone className="h-1.5 w-full rounded-full" />
                            <div className="flex justify-between">
                                <Bone className="h-2.5 w-24 rounded" />
                                <Bone className="h-2.5 w-8 rounded" />
                            </div>
                        </div>
                    </div>

                    {/* Players */}
                    <div className="rounded-xl bg-[#1a1a1a] border border-[#333] p-4 flex-1 flex flex-col gap-3 overflow-hidden">
                        {/* "N Players" heading + status dot */}
                        <div className="flex items-center justify-between flex-shrink-0">
                            <Bone className="h-4 w-24 rounded" />
                            <Bone className="h-3 w-3 rounded-full" />
                        </div>
                        {/* Offline label */}
                        <Bone className="h-2.5 w-14 rounded flex-shrink-0" />
                        {/* Search bar */}
                        <Bone className="h-8 w-full rounded-lg flex-shrink-0" />
                        {/* Player rows */}
                        <div className="flex flex-col gap-2.5 overflow-hidden flex-1">
                            {Array.from({ length: 7 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <Bone className="h-6 w-6 rounded-full flex-shrink-0" />
                                    <Bone className="h-2.5 flex-1 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* MIDDLE COLUMN */}
                <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-4 h-full min-h-0">

                    {/* Toolbox bar — 7 tabs matching real widths */}
                    <div className="rounded-xl bg-[#1a1a1a] border border-[#333] p-3 flex-shrink-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Bone className="h-9 w-24 rounded-lg" />  {/* Toolbox */}
                            <Bone className="h-9 w-24 rounded-lg" />  {/* Perm Log */}
                            <Bone className="h-9 w-28 rounded-lg" />  {/* Request LOA */}
                            <Bone className="h-9 w-32 rounded-lg" />  {/* Run Command */}
                            <Bone className="h-9 w-32 rounded-lg" />  {/* Staff Request */}
                            <Bone className="h-9 w-20 rounded-lg" />  {/* Calls */}
                            <Bone className="h-9 w-16 rounded-lg" />  {/* Map */}
                        </div>
                    </div>

                    {/* Logs panel */}
                    <div className="rounded-xl bg-[#1a1a1a] border border-[#222] flex-1 flex flex-col overflow-hidden">
                        {/* "Live Logs" header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] flex-shrink-0">
                            <Bone className="h-4 w-20 rounded" />
                            <Bone className="h-4 w-4 rounded" />
                        </div>
                        {/* Log rows: icon + content + timestamp */}
                        <div className="flex flex-col divide-y divide-white/[0.03] overflow-hidden">
                            {Array.from({ length: 13 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                                    <Bone className="h-4 w-4 rounded flex-shrink-0" />
                                    <Bone className="h-2.5 flex-1 rounded" style={{ maxWidth: `${55 + (i * 17) % 35}%` }} />
                                    <Bone className="h-2.5 w-24 rounded flex-shrink-0 ml-auto" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN — Punishments */}
                <div className="lg:col-span-1 flex flex-col h-full min-h-0 bg-[#1a1a1a] rounded-xl overflow-hidden border border-[#222]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] flex-shrink-0">
                        <Bone className="h-4 w-28 rounded" />
                        <Bone className="h-4 w-4 rounded" />
                    </div>
                    {/* Punishment cards */}
                    <div className="flex flex-col gap-0 overflow-hidden divide-y divide-white/[0.03]">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} className="px-4 py-3 space-y-2">
                                {/* Badge label */}
                                <Bone className="h-4 w-16 rounded-sm" />
                                {/* Avatar + username */}
                                <div className="flex items-center gap-2">
                                    <Bone className="h-6 w-6 rounded-full flex-shrink-0" />
                                    <Bone className="h-2.5 w-28 rounded" />
                                </div>
                                {/* Reason */}
                                <Bone className="h-2.5 w-3/4 rounded" />
                                {/* Timestamp */}
                                <Bone className="h-2 w-20 rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
