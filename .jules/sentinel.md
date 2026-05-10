## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2024-05-10 - Missing CSRF Protection on Discord Sync
**Vulnerability:** Missing CSRF validation on POST /api/discord/link and POST /api/discord/auto-assign.
**Learning:** Even though discord sync seems internal to the auth flow, state-modifying cookie-based endpoints must explicitly call verifyCsrf(req).
**Prevention:** Always verify verifyCsrf usage on API endpoints and update the frontend headers.
