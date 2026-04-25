## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.

## 2024-05-24 - Missing CSRF Protection on Discord Integration API Routes
**Vulnerability:** The `/api/discord/link` and `/api/discord/auto-assign` API endpoints were lacking CSRF protection, failing to enforce `verifyCsrf`. Since these are state-modifying endpoints (POST) operating on session-based authentication context, an attacker could force a victim to submit malicious cross-site requests to these endpoints.
**Learning:** Any new or existing Next.js backend API routes (POST, PATCH, DELETE, PUT) that use session-based authentication (like Clerk's `getSession`) must explicitly apply the `verifyCsrf` check. There's no global CSRF middleware covering API routes.
**Prevention:** Always search for `export async function POST` or similar state-modifying functions in API routes and ensure `verifyCsrf` is invoked as the first check. Furthermore, ensure corresponding frontend clients (e.g. `fetch` or `axios`) are updated to send the `x-csrf-check: "1"` header.
