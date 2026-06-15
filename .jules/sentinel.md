## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2025-02-27 - IDOR via Empty String Fallback in Prisma Queries
**Vulnerability:** Insecure Direct Object Reference (IDOR) and potential account takeover due to empty string fallback in Prisma `OR` queries.
**Learning:** Using `{ userId: robloxId || "" }` in a database query means if `robloxId` is falsy (e.g., null or undefined), it searches for an empty string. If any record in the DB happens to have an empty string `userId`, an unauthenticated or newly created user without a `robloxId` will falsely match that record, allowing them to link their Discord to someone else's member profile.
**Prevention:** Never use logical OR fallbacks like `|| ""` for identifiers in database conditions. Instead, dynamically construct the `OR` array and only push the condition `if (robloxId)` is truthy.
