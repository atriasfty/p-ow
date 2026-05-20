## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.

## 2024-05-20 - [IP Authentication Bypass]
**Vulnerability:** A hardcoded IP bypass existed in an admin API endpoint using the spoofable `x-forwarded-for` header.
**Learning:** `x-forwarded-for` can be spoofed by the client, and using it to bypass standard authentication for an administrative endpoint is a critical risk.
**Prevention:** Always enforce standard, robust session checks (like `getSession`) for admin operations and never rely on headers alone for authorization bypass.
