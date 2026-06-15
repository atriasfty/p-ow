## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2026-06-15 - Prisma ORM Query Injection / IDOR Risk
**Vulnerability:** A Prisma query searching by an optional ID field used a fallback of '|| ""'. This could inadvertently query the database for an empty string, potentially returning an unrelated record if one exists with an empty ID, leading to an IDOR or Account Takeover.
**Learning:** Falsy values passed into Prisma queries with logical OR fallbacks (like empty strings) are treated as literal search terms rather than being ignored.
**Prevention:** Avoid '|| ""' fallbacks in database queries. Instead, conditionally construct query objects or arrays (like the 'OR' array) only pushing truthy and valid identifiers before passing them to Prisma.
