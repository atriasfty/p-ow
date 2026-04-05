"use client"

import { X, AlertTriangle, Loader2 } from "lucide-react"

interface ConfirmModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
    isDestructive?: boolean
    isLoading?: boolean
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    isDestructive = true,
    isLoading = false
}: ConfirmModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-[#333] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header-less Close Button */}
                <button
                    onClick={onClose}
                    aria-label="Close confirmation dialog"
                    className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="p-8">
                    <div className="flex items-center gap-4 mb-6">
                        <div className={`p-3 rounded-xl ${isDestructive ? 'bg-red-500/10 text-red-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                            <AlertTriangle className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
                    </div>

                    <p className="text-zinc-400 text-sm leading-relaxed">
                        {description}
                    </p>

                    <div className="mt-8 flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 px-5 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-[#333] transition-all font-semibold text-sm border border-transparent hover:border-white/5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-all transform active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] ${isDestructive
                                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                                    : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/20'
                                }`}
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
