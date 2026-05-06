## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.

## 2024-05-06 - Missing CSRF Protection on Superadmin Config
**Vulnerability:** Missing CSRF protection on the POST and DELETE /api/admin/super/config endpoints.
**Learning:** Even highly privileged routes (like superadmin config updates/deletions) are vulnerable to CSRF if they rely solely on cookie-based session authentication without explicitly verifying the `x-pow-request` header via `verifyCsrf(req)`.
**Prevention:** Always include `verifyCsrf(req)` on any state-modifying Next.js API route, regardless of role-based access controls, and ensure frontend requests include the `x-csrf-check: '1'` header.
