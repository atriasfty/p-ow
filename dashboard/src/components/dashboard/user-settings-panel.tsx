"use client"

import { useState, useTransition } from "react"
import { Settings, X, Laptop, Trash2, Loader2 } from "lucide-react"
import { revokeDevice } from "@/lib/actions/vision-devices"
import { ConfirmModal } from "@/components/ui/confirm-modal"

export interface VisionDeviceSummary {
    id: string
    deviceName: string | null
    createdAt: string
    lastUsedAt: string | null
}

export function UserSettingsPanel({ devices }: { devices: VisionDeviceSummary[] }) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                aria-label="Settings"
                className="rounded-lg p-2.5 text-zinc-400 hover:bg-white/5 hover:text-white transition-colors border border-white/5"
            >
                <Settings className="h-4 w-4" />
            </button>

            {isOpen && <SettingsModal devices={devices} onClose={() => setIsOpen(false)} />}
        </>
    )
}

function SettingsModal({ devices, onClose }: { devices: VisionDeviceSummary[]; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-[#1a1a1a] rounded-2xl border border-[#333] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <h3 className="text-lg font-bold text-white tracking-tight">Settings</h3>
                    <button
                        onClick={onClose}
                        aria-label="Close settings"
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    <h4 className="text-sm font-semibold text-white mb-1">POW Vision Devices</h4>
                    <p className="text-xs text-zinc-500 mb-4">
                        Devices logged into POW Vision with your account. Up to 10 active devices allowed — revoke
                        one below to free up a slot.
                    </p>

                    <div className="rounded-xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                        {devices.length === 0 && (
                            <div className="p-6 text-center text-sm text-zinc-500">No devices logged in yet.</div>
                        )}
                        {devices.map((device) => (
                            <DeviceRow key={device.id} device={device} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

function DeviceRow({ device }: { device: VisionDeviceSummary }) {
    const [isPending, startTransition] = useTransition()
    const [showConfirm, setShowConfirm] = useState(false)

    const handleRevoke = () => {
        setShowConfirm(false)
        startTransition(async () => {
            await revokeDevice(device.id)
        })
    }

    return (
        <div className="flex items-center justify-between gap-4 p-3">
            <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400 shrink-0">
                    <Laptop className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{device.deviceName || "Unnamed device"}</p>
                    <p className="text-xs text-zinc-500">
                        Added {new Date(device.createdAt).toLocaleDateString()}
                        {device.lastUsedAt && ` • Last used ${new Date(device.lastUsedAt).toLocaleDateString()}`}
                    </p>
                </div>
            </div>

            <button
                onClick={() => setShowConfirm(true)}
                disabled={isPending}
                className="rounded-lg p-2 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-colors shrink-0 disabled:opacity-50"
                title="Revoke Device"
            >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>

            <ConfirmModal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleRevoke}
                title="Revoke Device"
                description={`"${device.deviceName || "this device"}" will be signed out of POW Vision immediately and will need to log in again to reconnect.`}
                confirmLabel="Revoke Device"
                isLoading={isPending}
            />
        </div>
    )
}
