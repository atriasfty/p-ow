"use client"


import { useFormState, useFormStatus } from "react-dom"
import { createInvitation } from "./actions"
import { Send } from "lucide-react"

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
        >
            <Send className="h-4 w-4" />
            {pending ? "Sending..." : "Send Invite"}
        </button>
    )
}

export function InviteForm() {
    const [state, formAction] = useFormState(createInvitation, null)

    return (
        <form action={formAction} className="flex gap-4 items-start">
            <div className="flex-1">
                <input
                    type="email"
                    name="email"
                    placeholder="colleague@example.com"
                    required
                    className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
                {state?.message && (
                    <p className={`mt-2 text-sm ${state.success ? "text-emerald-400" : "text-red-400"}`}>
                        {state.message}
                    </p>
                )}
            </div>
            <SubmitButton />
        </form>
    )
}
