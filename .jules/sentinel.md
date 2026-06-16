## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2026-06-16 - Prevent Falsy Fallbacks in DB Queries
**Vulnerability:** Insecure OR query conditions using `|| ""` or `?? ""` on optional user identifiers allowed unexpected broad matches (empty strings matching unrelated records), leading to Account Takeover and IDOR risks.
**Learning:** Prisma's behavior searches exactly for the empty string if supplied, avoiding strict type rejection but causing dangerous logical overlap.
**Prevention:** Dynamically assemble `OR` conditions arrays or wrap exact ID queries in conditional checks, ensuring falsy identifiers are never used as valid query values.
