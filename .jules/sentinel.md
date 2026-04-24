## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.

## 2026-04-24 - CSRF Protection Missing on Role Assignment API Routes
**Vulnerability:** The state-modifying cookie-based routes `/api/discord/link` and `/api/discord/auto-assign` lacked CSRF protection, enabling potential cross-site request forgery attacks that could alter user Discord roles and panel permissions.
**Learning:** Found multiple state-modifying routes across the Next.js API that lacked `verifyCsrf(req)` calls, because there is no system-wide CSRF middleware.
**Prevention:** Developers must explicitly ensure that all state-modifying endpoints (POST, PATCH, DELETE, PUT) include `verifyCsrf(req)` early in the request lifecycle and frontend API calls incorporate the `x-csrf-check` header.
