## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2026-05-03 - CSRF Protection in Automations API
**Vulnerability:** Missing CSRF protection on the POST and DELETE /api/admin/automations endpoints.
**Learning:** Even admin-only endpoints that rely on cookie-based session authentication are vulnerable to CSRF if they modify state (POST/DELETE) and do not explicitly call `verifyCsrf`. There is no global middleware enforcing this.
**Prevention:** Always include `if (!verifyCsrf(req))` at the beginning of mutating API routes in the dashboard, and ensure corresponding frontend `fetch` calls send the `x-csrf-check: '1'` header.
