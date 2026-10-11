"use client"

import { createContext, useContext, useState, useCallback, useRef } from "react"
import { AlertTriangle, CheckCircle, Info, X, Loader2 } from "lucide-react"

type Variant = "default" | "success" | "error" | "warning" | "destructive"

interface DialogState {
    type: "alert" | "confirm"
    title: string
    message: string
    variant: Variant
    confirmLabel?: string
    cancelLabel?: string
    resolve?: (value: boolean) => void
}

interface DialogContextType {
    showAlert: (title: string, message: string, variant?: Variant) => Promise<void>
    showConfirm: (title: string, message: string, confirmLabel?: string, variant?: Variant) => Promise<boolean>
}

const DialogContext = createContext<DialogContextType | null>(null)

export function useDialog() {
    const ctx = useContext(DialogContext)
    if (!ctx) throw new Error("useDialog must be used within a DialogProvider")
    return ctx
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
    const [dialog, setDialog] = useState<DialogState | null>(null)
    const [isClosing, setIsClosing] = useState(false)
    const resolveRef = useRef<((value: boolean) => void) | null>(null)

    const close = useCallback((result: boolean) => {
        setIsClosing(true)
        setTimeout(() => {
            resolveRef.current?.(result)
            resolveRef.current = null
            setDialog(null)
            setIsClosing(false)
        }, 150)
    }, [])

    const showAlert = useCallback((title: string, message: string, variant: Variant = "default"): Promise<void> => {
        return new Promise((resolve) => {
            resolveRef.current = () => resolve()
            setDialog({ type: "alert", title, message, variant })
        })
    }, [])

    const showConfirm = useCallback((title: string, message: string, confirmLabel?: string, variant: Variant = "destructive"): Promise<boolean> => {
        return new Promise((resolve) => {
            resolveRef.current = resolve
            setDialog({
                type: "confirm",
                title,
                message,
                variant,
                confirmLabel: confirmLabel || "Confirm",
                cancelLabel: "Cancel"
            })
        })
    }, [])

    const iconMap: Record<Variant, React.ReactNode> = {
        default: <Info className="h-5 w-5 text-indigo-400" />,
        success: <CheckCircle className="h-5 w-5 text-emerald-400" />,
        error: <AlertTriangle className="h-5 w-5 text-red-400" />,
        warning: <AlertTriangle className="h-5 w-5 text-amber-400" />,
        destructive: <AlertTriangle className="h-5 w-5 text-red-400" />
    }

    const confirmColorMap: Record<Variant, string> = {
        default: "bg-indigo-600 hover:bg-indigo-500 text-white",
        success: "bg-emerald-600 hover:bg-emerald-500 text-white",
        error: "bg-red-600 hover:bg-red-500 text-white",
        warning: "bg-amber-600 hover:bg-amber-500 text-white",
        destructive: "bg-red-600 hover:bg-red-500 text-white"
    }

    const borderColorMap: Record<Variant, string> = {
        default: "border-indigo-500/30",
        success: "border-emerald-500/30",
        error: "border-red-500/30",
        warning: "border-amber-500/30",
        destructive: "border-red-500/30"
    }

    return (
        <DialogContext.Provider value={{ showAlert, showConfirm }}>
            {children}

            {dialog && (
                <div
                    className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-150 ${isClosing ? "opacity-0" : "opacity-100"}`}
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => close(false)}
                    />

                    {/* Modal */}
                    <div
                        className={`relative bg-zinc-900 border ${borderColorMap[dialog.variant]} rounded-2xl max-w-md w-full p-6 shadow-2xl transition-all duration-150 ${isClosing ? "scale-95 opacity-0" : "scale-100 opacity-100"}`}
                    >
                        {/* Close Button */}
                        <button
                            onClick={() => close(false)}
                            aria-label="Close dialog"
                            className="absolute top-4 right-4 p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        {/* Header */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                                {iconMap[dialog.variant]}
                            </div>
                            <h3 className="text-lg font-bold text-white pr-6">{dialog.title}</h3>
                        </div>

                        {/* Message */}
                        <p className="text-sm text-zinc-400 leading-relaxed mb-6 pl-[52px]">
                            {dialog.message}
                        </p>

                        {/* Actions */}
                        <div className="flex justify-end gap-3">
                            {dialog.type === "confirm" && (
                                <button
                                    onClick={() => close(false)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-white/10 transition-colors"
                                >
                                    {dialog.cancelLabel}
                                </button>
                            )}
                            <button
                                onClick={() => close(true)}
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${confirmColorMap[dialog.variant]}`}
                                autoFocus
                            >
                                {dialog.type === "confirm" ? dialog.confirmLabel : "OK"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DialogContext.Provider>
    )
}
