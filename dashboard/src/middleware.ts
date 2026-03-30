import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// 1. Identify "protected" routes that should be blocked by maintenance
const isDashboardRoute = createRouteMatcher(["/dashboard(.*)", "/api/(.*)"]);
const isSuperAdminRoute = createRouteMatcher(["/admin/super(.*)", "/api/admin/super(.*)"]);
const isPublicApi = createRouteMatcher(["/api/maintenance-check", "/api/vision/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
    const { userId, sessionClaims } = await auth();

    // 2. Check Maintenance Mode from Prisma via a fast internal fetch (or direct if edge-compatible)
    // Since Middleware runs on Edge, we'll use our existing maintenance-check API internally 
    // or just check the environment/DB if we have a direct connection.
    // For simplicity and reliability with Prisma, we'll fetch our own internal status API.
    
    if (isDashboardRoute(req) && !isPublicApi(req)) {
        try {
            // Robust internal fetch: try public URL first, then localhost if it fails
            let res;
            try {
                res = await fetch(`${req.nextUrl.origin}/api/maintenance-check`, {
                    cache: 'no-store',
                    signal: AbortSignal.timeout(2000) // Don't hang middleware
                });
            } catch (e) {
                // Fallback to localhost if public URL fails (common in VPS setups)
                res = await fetch(`http://localhost:${process.env.PORT || 41729}/api/maintenance-check`, {
                    cache: 'no-store',
                    signal: AbortSignal.timeout(2000)
                });
            }
            
            const data = await res.json();

            if (data.maintenance) {
                // ALLOW Superadmins even in maintenance
                // Assuming sessionClaims.metadata.role is how we identify superadmins
                // Or checking a specific user ID if metadata isn't set
                const isSuper = (sessionClaims?.metadata as any)?.role === 'superadmin' || userId === 'user_36ogKIU3qHTwhGT3mrVtvUrTgbW';
                
                if (!isSuper && !isSuperAdminRoute(req)) {
                    // Redirect to a static maintenance page or return 503 for APIs
                    if (req.nextUrl.pathname.startsWith('/api')) {
                        return new NextResponse(JSON.stringify({ error: "Service Unavailable: Maintenance Mode" }), { 
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                    // For UI, the MaintenanceGate component will handle it, 
                    // but we could also force a redirect here if we wanted to be super strict.
                }
            }
        } catch (e) {
            // Fail open on check error
            console.error("Middleware maintenance check failed:", e);
        }
    }
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
