## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2023-10-27 - Fix IDOR/Account Takeover in Discord Link
**Vulnerability:** Prisma logical OR fallback in Discord link endpoint (`robloxId || ""`) could lead to Account Takeover or IDOR if `robloxId` is empty.
**Learning:** Avoid using logical OR fallbacks like `|| ""` for user identifiers in database query conditions. If the variable is falsy, the query searches for an empty string, which can inadvertently match unrelated user records.
**Prevention:** Dynamically construct an array of truthy conditions and pass this array to the `where` clause.
