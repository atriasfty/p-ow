
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
 * CSRF protection for API routes that use session cookies.
 *
 * Requires the custom `X-POW-Request: 1` header. Browsers enforce a CORS
 * preflight for any non-simple request header, so a cross-origin attacker
 * cannot set it without server cooperation. Our dashboard fetches always
 * include it; plain form posts and curl attacks do not.
 *
 * Also verifies Origin/Referer when present so old browser quirks (no
 * preflight) are still caught.
 */
export function verifyCsrf(req: Request): boolean {
    // Primary check: custom header that cross-origin requests cannot set.
    if (!req.headers.get("x-pow-request")) return false

    const origin = req.headers.get("origin")
    const referer = req.headers.get("referer")
    const host = req.headers.get("host")

    if (!host) return false

    // If the browser sent an Origin or Referer, it must match our host.
    try {
        if (origin) return new URL(origin).host === host
        if (referer) return new URL(referer).host === host
    } catch {
        return false
    }

    // No Origin/Referer (e.g. same-origin fetch with stripped referrer policy) —
    // the custom header alone is sufficient.
    return true
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

