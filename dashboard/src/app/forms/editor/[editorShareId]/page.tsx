"use client"

import { apiFetch } from "@/lib/api-fetch"
import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Check, AlertCircle } from "lucide-react"

export default function EditorAccessPage({
    params,
}: {
    params: Promise<{ editorShareId: string }>
}) {
    const { editorShareId } = use(params)
    const router = useRouter()
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
    const [message, setMessage] = useState("")
    const [formInfo, setFormInfo] = useState<{ formId: string; serverId: string; formTitle: string } | null>(null)

    useEffect(() => {
        claimAccess()
    }, [editorShareId])

    const claimAccess = async () => {
        try {
            const res = await apiFetch("/api/forms/editor-access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ editorShareId })
            })

            const data = await res.json()

            if (!res.ok) {
                setStatus("error")
                setMessage(data.error || "Failed to claim access")
                return
            }

            setStatus("success")
            setMessage(data.message)
            setFormInfo({
                formId: data.formId,
                serverId: data.serverId,
                formTitle: data.formTitle
            })
        } catch {
            setStatus("error")
            setMessage("Something went wrong")
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
            <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-8 max-w-md w-full text-center">
                {status === "loading" && (
                    <>
                        <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">Claiming Editor Access</h2>
                        <p className="text-zinc-400">Please wait...</p>
                    </>
                )}

                {status === "success" && formInfo && (
                    <>
                        <div className="h-16 w-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Check className="h-8 w-8 text-emerald-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">{message}</h2>
                        <p className="text-zinc-400 mb-6">
                            You now have edit access to <span className="text-white font-medium">{formInfo.formTitle}</span>
                        </p>
                        <button
                            onClick={() => router.push(`/dashboard/${formInfo.serverId}/forms/${formInfo.formId}/edit`)}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
                        >
                            Open Form Editor
                        </button>
                    </>
                )}

                {status === "error" && (
                    <>
                        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
                        <p className="text-zinc-400 mb-6">{message}</p>
                        <a
                            href="/login"
                            className="block w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors text-center"
                        >
                            Login
                        </a>
                    </>
                )}
            </div>
        </div>
    )
}
