
import { SessionUser, getUserPermissions, RolePermissions } from "@/lib/admin"
import { NextResponse } from "next/server"
import { redirect } from "next/navigation"

/**
 * Checks if a user has a specific permission on a server server-side.
 */
export async function checkPermission(
    user: SessionUser | null,
    serverId: string,
    permission: keyof RolePermissions
): Promise<boolean> {
    if (!user) return false
    const permissions = await getUserPermissions(user, serverId)
    return permissions[permission]
}

/**
 * Verifies a permission and returns a 403 NextResponse if missing.
 * Use this in API routes.
 */
export async function verifyPermissionOrError(
    user: SessionUser | null,
    serverId: string,
    permission: keyof RolePermissions
): Promise<NextResponse | null> {
    const hasAccess = await checkPermission(user, serverId, permission)
    if (!hasAccess) {
        return new NextResponse("Forbidden: Missing Permission " + permission, { status: 403 })
    }
    return null // Access granted
}

/**
 * Verifies a permission and redirects if missing.
 * Use this in Server Components (Pages/Layouts).
 */
export async function verifyPermissionOrRedirect(
    user: SessionUser | null,
    serverId: string,
    permission: keyof RolePermissions,
    redirectPath: string = `/dashboard/${serverId}/mod-panel`
) {
    const hasAccess = await checkPermission(user, serverId, permission)
    if (!hasAccess) {
        redirect(redirectPath)
    }
}

/**
 * Simple CSRF protection for API routes that use session cookies.
 * Verifies the Origin or Referer header against the current request host.
 */
export function verifyCsrf(req: Request): boolean {
    const origin = req.headers.get("origin")
    const referer = req.headers.get("referer")
    const host = req.headers.get("host") // e.g. pow.ciankelly.xyz

    if (!host) return false

    try {
        if (origin) {
            return new URL(origin).host === host
        }

        if (referer) {
            return new URL(referer).host === host
        }
    } catch (e) {
        return false
    }

    // Fallback: If it's a browser request with cookies but no origin/referer,
    // it's likely a standard navigation or a script-less form post.
    // For our API (fetch), origin is always present in POST/PATCH/DELETE.
    return false
}

/**
 * Sanitizes a URL to prevent javascript: XSS attacks.
 */
export function sanitizeUrl(url: string | null | undefined): string {
    if (!url) return ""
    const trimmed = url.trim()
    if (trimmed.toLowerCase().startsWith("javascript:") || trimmed.toLowerCase().startsWith("data:")) {
        return "about:blank"
    }
    return trimmed
}

