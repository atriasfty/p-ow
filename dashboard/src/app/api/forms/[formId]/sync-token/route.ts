import { NextResponse } from "next/server"
import crypto from "crypto"
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"

/**
 * Issues a short-lived token authorizing the caller to connect to the Yjs
 * sync server for ONE specific form document. The sync server verifies the
 * token's HMAC and that the requested doc name matches the token's room.
 *
 * Replaces the previous design where every browser received a shared
 * NEXT_PUBLIC_SYNC_WS_SECRET — which let any holder of that secret subscribe
 * to any document across all tenants.
 */
async function canEditForm(userId: string, formId: string): Promise<boolean> {
    const form = await prisma.form.findUnique({
        where: { id: formId },
        select: { serverId: true }
    })
    if (!form) return false

    const isAdmin = await isServerAdmin({ id: userId } as any, form.serverId)
    if (isAdmin) return true

    const editorAccess = await prisma.formEditorAccess.findUnique({
        where: { formId_userId: { formId, userId } }
    })
    return !!editorAccess
}

function b64url(buf: Buffer | string): string {
    return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ formId: string }> }
) {
    const secret = process.env.SYNC_WS_SECRET
    if (!secret) return new NextResponse("Sync not configured", { status: 500 })

    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { formId } = await params
    const allowed = await canEditForm(session.user.id, formId)
    if (!allowed) return new NextResponse("Forbidden", { status: 403 })

    const room = `form-room-${formId}`
    const payload = {
        sub: session.user.id,
        room,
        exp: Math.floor(Date.now() / 1000) + 5 * 60 // 5 minutes
    }
    const payloadB64 = b64url(JSON.stringify(payload))
    const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest()
    const token = `${payloadB64}.${b64url(sig)}`

    return NextResponse.json({ token, room, expiresIn: 300 })
}
