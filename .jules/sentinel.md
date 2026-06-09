## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2026-04-24 - Prisma OR fallback vulnerability
**Vulnerability:** Database query uses || "" fallback for user identifiers.
**Learning:** Falsy variables cause the query to match empty strings, leading to Account Takeover or IDOR.
**Prevention:** Dynamically push valid truthy conditions to an array and use it in the where clause.
