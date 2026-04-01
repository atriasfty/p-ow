## 2025-02-17 - Missing CSRF Protection on Admin Role Endpoints
**Vulnerability:** The `POST`, `PATCH`, and `DELETE` endpoints in `dashboard/src/app/api/admin/roles/route.ts` lacked Cross-Site Request Forgery (CSRF) protection.
**Learning:** Even though the endpoints require authentication via Clerk (`getSession()`), they were vulnerable to CSRF attacks because they rely on session cookies. A malicious site could have tricked an authenticated user's browser into sending state-changing requests to manage admin roles.
**Prevention:** Always use the `verifyCsrf(req)` helper from `@/lib/auth-permissions` at the beginning of any state-modifying API route (`POST`, `PATCH`, `DELETE`) in the Next.js dashboard, returning a `403 Forbidden` response if the verification fails.
