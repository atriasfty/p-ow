## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2024-05-01 - Missing CSRF Protection on Discord/Subscription API Routes
**Vulnerability:** Found `POST` and `DELETE` API routes (`/api/discord/link`, `/api/discord/auto-assign`, `/api/subscription/link`) lacking `verifyCsrf(req)` validation. Since these routes modify state (e.g. database updates) and rely on session cookies via `getSession()` and `@clerk/nextjs/server`'s `auth()`, they were vulnerable to Cross-Site Request Forgery (CSRF).
**Learning:** In Next.js App Router, there is no system-wide CSRF middleware configured in this project. Thus, *every* state-modifying route (POST, PATCH, DELETE, PUT) that uses cookie-based authentication MUST explicitly call `verifyCsrf(req)`.
**Prevention:** Always manually add `if (!verifyCsrf(req)) { return new NextResponse("Forbidden", { status: 403 }) }` to mutating API routes. Additionally, ensure the frontend calls include the `x-csrf-check: "1"` header to comply with the project standards for CSRF protection and avoid pre-flight issues.
