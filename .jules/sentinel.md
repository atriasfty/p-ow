## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2024-05-24 - Missing CSRF checks on state-modifying endpoints
**Vulnerability:** Found multiple API endpoints (e.g. discord/link, admin/server/verify-creation) that modify state but miss the verifyCsrf check.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) from @/lib/auth-permissions since the Next.js application lacks system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
