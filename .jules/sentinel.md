## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2026-06-14 - IDOR/Account Takeover in Prisma Queries with Fallback Strings
**Vulnerability:** IDOR/Account Takeover risk due to using logical OR fallbacks (e.g., `|| ""`) in Prisma query `OR` arrays.
**Learning:** If a variable like `robloxId` is falsy, the query falls back to searching for `userId: ""` (an empty string). If dummy or incomplete records exist with an empty string for `userId`, the query can unintentionally match them, granting unauthorized access.
**Prevention:** Construct conditional query arrays dynamically. Only push valid, truthy variables to the `OR` array before using it in the database query.
