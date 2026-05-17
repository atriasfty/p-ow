import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// 1. Identify "protected" routes that should be blocked by maintenance
const isDashboardRoute = createRouteMatcher(["/dashboard(.*)", "/api/(.*)"]);
const isSuperAdminRoute = createRouteMatcher(["/admin/super(.*)", "/api/admin/super(.*)"]);
const isPublicApi = createRouteMatcher(["/api/maintenance-check", "/api/vision/(.*)"]);

const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_ID || "user_36ogKIU3qHTwhGT3mrVtvUrTgbW";

// Module-level cache so we don't fan out a fetch per request. TTL is short so
// toggling maintenance still propagates quickly. STALE_LIMIT bounds how long
// we will keep serving the last-known-good value if the check is failing.
const FRESH_TTL_MS = 5_000
const STALE_LIMIT_MS = 60_000

type CacheEntry = { maintenance: boolean; fetchedAt: number }
let maintenanceCache: CacheEntry | null = null
let inflight: Promise<CacheEntry | null> | null = null

async function fetchMaintenanceState(origin: string): Promise<CacheEntry | null> {
    if (inflight) return inflight
    inflight = (async () => {
        const attempt = async (url: string) =>
            fetch(url, { cache: "no-store", signal: AbortSignal.timeout(2000) })

        try {
            let res: Response
            try {
                res = await attempt(`${origin}/api/maintenance-check`)
            } catch {
                res = await attempt(`http://localhost:${process.env.PORT || 41729}/api/maintenance-check`)
            }
            if (!res.ok) return null
            const data = await res.json()
            const entry: CacheEntry = {
                maintenance: !!data.maintenance,
                fetchedAt: Date.now()
            }
            maintenanceCache = entry
            return entry
        } catch (e) {
            console.error("[middleware] maintenance check failed:", e)
            return null
        } finally {
            inflight = null
        }
    })()
    return inflight
}

async function getMaintenanceState(origin: string): Promise<{ maintenance: boolean; degraded: boolean }> {
    const now = Date.now()

    if (maintenanceCache && now - maintenanceCache.fetchedAt < FRESH_TTL_MS) {
        return { maintenance: maintenanceCache.maintenance, degraded: false }
    }

    const fresh = await fetchMaintenanceState(origin)
    if (fresh) return { maintenance: fresh.maintenance, degraded: false }

    // Fetch failed. Reuse the last value if it's not too stale.
    if (maintenanceCache && now - maintenanceCache.fetchedAt < STALE_LIMIT_MS) {
        return { maintenance: maintenanceCache.maintenance, degraded: true }
    }

    // No fresh data and no acceptable cache → fail closed (treat as maintenance)
    // so we don't bypass the gate during a partial outage.
    return { maintenance: true, degraded: true }
}

export default clerkMiddleware(async (auth, req) => {
    const { userId } = await auth();

    if (!isDashboardRoute(req) || isPublicApi(req)) return

    const { maintenance } = await getMaintenanceState(req.nextUrl.origin)

    if (!maintenance) return

    // Hardcoded super-admin gate. Clerk publicMetadata can be writable by the
    // app/user depending on configuration, so we no longer trust a "role"
    // claim here — only the explicit user ID.
    const isSuper = userId === SUPER_ADMIN_ID

    if (isSuper || isSuperAdminRoute(req)) return

    if (req.nextUrl.pathname.startsWith("/api")) {
        return new NextResponse(JSON.stringify({ error: "Service Unavailable: Maintenance Mode" }), {
            status: 503,
            headers: { "Content-Type": "application/json" }
        })
    }
    // For UI routes, the MaintenanceGate component handles user-facing rendering.
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
