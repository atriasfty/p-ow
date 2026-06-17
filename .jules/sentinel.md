## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2026-04-23 - NoSQL/Prisma Injection in API route
**Vulnerability:** Prisma object injection vulnerability on the POST /api/admin/server/danger endpoint where `value` was not strictly verified to be a string.
**Learning:** When using user input directly inside Prisma `where` or `data` objects, failing to check `typeof value === "string"` allows NoSQL-style object injection (e.g. `value: {"not": "something"}`) which bypasses checks and corrupts data.
**Prevention:** Ensure all JSON body fields used in Prisma queries are strictly type-checked (e.g. `typeof value !== "string"`) before being passed to Prisma.
