import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth-clerk"
import { SignJWT } from "jose"
import { CopyButton } from "./copy-button"

export const dynamic = 'force-dynamic'

const VISION_SECRET = new TextEncoder().encode(
    process.env.VISION_JWT_SECRET!
)

// Import the handshake codes map from the shared store
import { handshakeCodes } from "@/lib/handshake-store"

interface Props {
    searchParams: Promise<{ code?: string }>
}

export default async function VisionAuthPage({ searchParams }: Props) {
    const { code: handshakeCode } = await searchParams

    // Check if user is logged in first
    const session = await getSession()

    if (!session?.user) {
        // Redirect to login with the code preserved
        if (handshakeCode) {
            redirect(`/login?redirect_url=${encodeURIComponent(`/vision-auth?code=${handshakeCode}`)}`)
        }
        redirect("/login?redirect_url=/vision-auth")
    }

    // Validate handshake code exists
    if (!handshakeCode) {
        return <AccessDenied message="Missing authentication code. Please use POW Vision to access this page." />
    }

    // Look up and validate the handshake code
    const handshake = await handshakeCodes.get(handshakeCode)

    if (!handshake) {
        return <AccessDenied message="Invalid or expired code. Please try again from POW Vision." />
    }

    // Check expiry
    if (Date.now() > handshake.expiresAt) {
        await handshakeCodes.delete(handshakeCode)
        return <AccessDenied message="This code has expired. Please try again from POW Vision." />
    }

    // Consume the code (one-time use)
    await handshakeCodes.delete(handshakeCode)

    // Generate the token
    const token = await new SignJWT({
        userId: session.user.id,
        username: session.user.username,
        robloxId: session.user.robloxId,
        robloxUsername: session.user.robloxUsername,
        discordId: session.user.discordId
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .setIssuer("pow-dashboard")
        .setAudience("pow-vision")
        .sign(VISION_SECRET)

    return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-8">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                        <span className="text-white text-2xl font-bold">P</span>
                    </div>
                    <h1 className="text-white text-2xl font-bold mb-2">POW Vision Token</h1>
                    <p className="text-white/50 text-sm">
                        Copy this token and paste it into POW Vision to log in.
                    </p>
                </div>

                <div className="mb-6">
                    <label className="block text-white/40 text-xs uppercase font-bold mb-2">
                        Your Token
                    </label>
                    <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-4">
                        <code className="text-indigo-400 text-xs break-all select-all">
                            {token}
                        </code>
                    </div>
                    <p className="text-white/30 text-xs mt-2">
                        This token expires in 7 days. Keep it secret!
                    </p>
                </div>

                <div className="space-y-3">
                    <CopyButton token={token} />
                    <a
                        href="/dashboard"
                        className="block w-full text-center py-3 rounded-lg bg-[#1e1e2e] hover:bg-[#2a2a3a] text-white/60 text-sm transition-colors"
                    >
                        Back to Dashboard
                    </a>
                </div>

                <div className="mt-6 pt-6 border-t border-[#1e1e2e]">
                    <p className="text-white/30 text-xs text-center">
                        Logged in as <span className="text-white/50">{session.user.username}</span>
                        {session.user.robloxUsername && (
                            <> • Roblox: <span className="text-white/50">{session.user.robloxUsername}</span></>
                        )}
                    </p>
                </div>
            </div>
        </div>
    )
}

function AccessDenied({ message }: { message: string }) {
    return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-8">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
                        <span className="text-white text-2xl">⚠️</span>
                    </div>
                    <h1 className="text-white text-2xl font-bold mb-2">Access Denied</h1>
                    <p className="text-white/50 text-sm mb-6">
                        {message}
                    </p>
                    <a
                        href="/dashboard"
                        className="inline-block px-6 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors"
                    >
                        Go to Dashboard
                    </a>
                </div>
            </div>
        </div>
    )
}
