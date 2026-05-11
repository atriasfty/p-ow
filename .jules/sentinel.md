## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2024-05-11 - Missing CSRF Protection on Role Sync API Routes
**Vulnerability:** The `/api/discord/link` and `/api/discord/auto-assign` POST routes modified database state without CSRF verification, allowing cross-site attacks to link discord IDs or force auto-assign routines.
**Learning:** Client-called API routes that don't utilize centralized request wrappers (like `apiFetch`) frequently omit custom CSRF headers, leading developers to omit the server-side `verifyCsrf` check to prevent functional breakage.
**Prevention:** Always enforce `verifyCsrf(req)` on all state-modifying API routes (POST, PUT, PATCH, DELETE) and ensure the corresponding client fetch requests manually include the `x-csrf-check: '1'` header, regardless of whether they use a wrapper.
