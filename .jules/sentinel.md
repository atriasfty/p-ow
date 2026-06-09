## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.

## 2024-06-09 - Prisma ORM Empty String Fallback
**Vulnerability:** Using logical OR fallbacks like `|| ""` for user identifiers in database query conditions can lead to Account Takeover or IDOR vulnerabilities.
**Learning:** If the variable is falsy, the query searches for an empty string, which can inadvertently match unrelated user records.
**Prevention:** Dynamically push valid, truthy conditions to an array and use that array within the `where` clause instead of inline logical ORs.
