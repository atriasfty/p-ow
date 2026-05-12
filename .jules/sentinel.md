## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.

## 2024-05-12 - CSRF Protection in Discord Role Sync Routes
**Vulnerability:** Missing CSRF protection on POST /api/discord/link and POST /api/discord/auto-assign endpoints.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) and ensure their frontend fetches include the x-pow-request and x-csrf-check headers since there is no system-wide CSRF middleware.
**Prevention:** Ensure all Next.js API routes handling POST/PATCH/DELETE/PUT use verifyCsrf(req).
