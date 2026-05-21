## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2024-05-21 - Missing CSRF Protection on Session Routes
**Vulnerability:** Found state-modifying API route (POST /api/discord/link) that used session cookies but missed explicit verifyCsrf checks.
**Learning:** The Next.js app lacks system-wide CSRF middleware, so every state-modifying route (POST/PATCH/DELETE/PUT) using getSession must manually invoke verifyCsrf.
**Prevention:** Create automated linting rules or mandatory review checklists to ensure verifyCsrf is called on all cookie-authenticated POST/PATCH/PUT/DELETE routes.
