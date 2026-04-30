## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2025-02-18 - Missing CSRF Check on Superadmin API
**Vulnerability:** The `/api/admin/super/config` API route was missing the `verifyCsrf` check on both `POST` and `DELETE` requests, making it vulnerable to CSRF attacks for superadmin users.
**Learning:** State-modifying cookie-based API routes, even those restricted by `isSuperAdmin`, must manually invoke `verifyCsrf(req)` because there is no system-wide Next.js middleware enforcing this protection. The corresponding frontend components must include the `x-csrf-check: '1'` header when communicating with these endpoints.
**Prevention:** Future API route creation involving data mutation via session cookies should implement the CSRF check proactively.
