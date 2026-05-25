## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2026-04-24 - CSRF Protection Client Integration
**Vulnerability:** Adding CSRF protection to an endpoint without updating the client.
**Learning:** When enforcing `verifyCsrf` on Next.js backend API routes, frontend client requests must include both `x-pow-request: '1'` and `x-csrf-check: '1'` headers. If using standard `fetch` or `axios`, both headers must be explicitly added to bypass the pre-flight checks.
**Prevention:** Always verify and update the client-side fetch calls to include the required CSRF headers when adding CSRF protection to an endpoint.
