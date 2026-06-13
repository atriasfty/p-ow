## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.

## 2026-04-23 - Prisma ORM Fallback Vulnerability
**Vulnerability:** Insecure OR fallback in Prisma query matching empty string `""` for `userId`.
**Learning:** Using `|| ""` as a fallback for user identifiers in database queries can match unintended records with empty IDs, leading to Account Takeover or IDOR.
**Prevention:** Use dynamic arrays for `OR` conditions and only push valid, truthy identifier objects into the array before querying.
