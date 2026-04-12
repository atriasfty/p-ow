## 2024-03-31 - Overly Permissive CORS Policy in Vision API
**Vulnerability:** The Vision API routes (`/api/vision/*`) were configured with `Access-Control-Allow-Origin: *`, allowing requests from any domain.
**Learning:** This occurred because the Electron desktop application required access from `file://` protocol (which evaluates to a `null` origin) and local development needed access from `localhost:5173`. Instead of explicitly whitelisting these origins alongside the production web app, a wildcard was used as a shortcut.
**Prevention:** Always implement dynamic evaluation of the `Origin` header against a strict, predefined whitelist of allowed domains/protocols when supporting complex client architectures (like Electron + Web) instead of falling back to a wildcard.
## 2026-04-02 - CSRF Protection in API routes
State-modifying API routes (POST, PATCH, DELETE) in the Next.js dashboard must be protected against Cross-Site Request Forgery (CSRF) by using the `verifyCsrf(req)` helper from `@/lib/auth-permissions`. Requests failing this check should immediately return a 403 Forbidden response. This prevents attackers from forcing authenticated users' browsers to send unwanted requests to these endpoints.
## 2024-11-20 - Missing CSRF Protection on API Routes
**Vulnerability:** Several state-modifying API routes (POST, PATCH, DELETE) such as `api/admin/members/role` and `api/admin/members` were missing CSRF protection checks (`verifyCsrf(req)`). Cookie-based Next.js App Router API endpoints do not have implicit CSRF protection unlike Server Actions.
**Learning:** Even if an endpoint uses `getSession()` to authenticate the user, without a CSRF validation check, a malicious external site could trick the authenticated user's browser into making unauthorized state-modifying requests (like granting admin privileges).
**Prevention:** Always explicitly apply `verifyCsrf(req)` to all state-modifying endpoints (POST, PATCH, DELETE, PUT) that rely on cookie-based session authentication in the Next.js App Router.

## 2025-02-28 - Missing CSRF in App Router API
**Vulnerability:** Cookie-based App Router API endpoints that change state (POST/PATCH/DELETE) lack Next.js's built-in Server Actions CSRF protections. Endpoints like `admin/grant/route.ts` were missing CSRF validation entirely.
**Learning:** The Next.js dashboard uses a custom `verifyCsrf` helper for cookie-based API routes because `route.ts` files do not inherit Next.js Server Actions CSRF protections inherently.
**Prevention:** Always ensure `verifyCsrf(req)` is imported from `@/lib/auth-permissions` and called at the top of any state-modifying API route that authenticates via `getSession()`.

## 2026-04-12 - Missing CSRF Protection on Superadmin Config Endpoint
**Vulnerability:** The `/api/admin/super/config/route.ts` endpoint (both POST and DELETE) lacked CSRF protection, allowing cross-site requests to potentially manipulate superadmin configuration.
**Learning:** Even highly privileged endpoints like those restricted to `isSuperAdmin()` need CSRF protection. A malicious site could trick an authenticated superadmin into making unintended configuration changes.
**Prevention:** Ensure `verifyCsrf()` is used on all state-modifying superadmin routes.
