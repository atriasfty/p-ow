## 2024-05-24 - Missing CSRF checks on state-modifying endpoints
**Vulnerability:** Found multiple state-modifying dashboard API routes (e.g. POST /api/admin/rollback, POST /api/admin/server/create, POST /api/admin/automations) that lack the standard `verifyCsrf` check required by memory constraints.
**Learning:** State-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) in the Next.js dashboard must explicitly call `verifyCsrf(req)` from `@/lib/auth-permissions` to prevent Cross-Site Request Forgery (CSRF). There is no system-wide CSRF middleware.
**Prevention:** Always add `if (!verifyCsrf(req)) return new NextResponse("Forbidden", { status: 403 })` to mutating API routes within the dashboard (excluding public/vision/internal endpoints that use header-based auth).
