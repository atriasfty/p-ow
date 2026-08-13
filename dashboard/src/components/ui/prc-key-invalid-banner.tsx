import { KeyRound } from "lucide-react"

/**
 * Shown when Server.prcKeyInvalid is set — PRC returned 403 for this
 * server's key, so sync has stopped (see api/internal/sync/route.ts).
 * Wording differs by audience: the actual server owner gets a direct
 * instruction, everyone else (staff/admins who aren't the owner) gets a
 * third-person nudge to go tell them, since they can't fix it themselves.
 */
export function PrcKeyInvalidBanner({ invalid, isOwner }: { invalid: boolean; isOwner: boolean }) {
    if (!invalid) return null

    return (
        <div className="flex items-center gap-2 bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-red-400 text-xs font-medium flex-shrink-0">
            <KeyRound className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
                {isOwner
                    ? "Your PRC Server-Key is invalid — syncing has stopped. Regenerate it in-game and update it in Admin → General."
                    : "This server's PRC Server-Key is invalid and syncing has stopped. Please let the server owner know so they can regenerate it."}
            </span>
        </div>
    )
}
