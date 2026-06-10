## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.

## 2026-06-10 - Prisma OR Fallback IDOR/Account Takeover
**Vulnerability:** Prisma queries with fallback string values (e.g., `{ userId: robloxId || "" }`) can match unrelated records if the database contains empty string values for that field.
**Learning:** If a variable is falsy, the `|| ""` fallback causes Prisma to query for an empty string. If an empty string exists in the database for that column, it will incorrectly return that record, potentially leading to Account Takeover or Insecure Direct Object Reference (IDOR).
**Prevention:** Avoid logical OR fallbacks in Prisma `where` conditions. Instead, dynamically construct the condition array by pushing only truthy values before executing the query.
