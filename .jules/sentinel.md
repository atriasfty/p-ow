## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.

## 2024-05-19 - Hardcoded IP Bypass
**Vulnerability:** A hardcoded IP bypass check in `dashboard/src/app/api/admin/metrics/route.ts` allows bypassing authentication using a spoofable `x-forwarded-for` header.
**Learning:** Hardcoding IPs and trusting `x-forwarded-for` for authentication bypass is inherently insecure as `x-forwarded-for` is client-controlled.
**Prevention:** Remove hardcoded IP bypasses and force authentication checks via `getSession()`.
