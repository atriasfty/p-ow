## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2026-06-11 - Prisma ORM Empty String IDOR Fallback
**Vulnerability:** Logical OR fallback like `|| ""` for user identifiers in Prisma database query conditions (e.g., `{ userId: externalId || "" }`).
**Learning:** If the variable is falsy, the query searches for an empty string, which can inadvertently match unrelated user records and lead to Account Takeover or Insecure Direct Object Reference (IDOR) vulnerabilities.
**Prevention:** Dynamically push valid, truthy conditions to an array and use that within the `where` clause.
