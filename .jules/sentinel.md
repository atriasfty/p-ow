## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.

## 2026-04-25 - CSRF Protection in Discord Integration Endpoints
**Vulnerability:** Missing CSRF protection on the POST /api/discord/link and POST /api/discord/auto-assign endpoints.
**Learning:** State-modifying cookie-based API routes, particularly sensitive authorization endpoints like role assignment and ID linking, must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
