## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2024-05-24 - Missing CSRF validation on Admin Shift Routes
**Vulnerability:** The POST and DELETE handlers in `api/admin/shifts/route.ts` were missing `verifyCsrf` validation checks.
**Learning:** Even internal admin API routes restricted by `isServerAdmin` are vulnerable to CSRF attacks if they accept state-modifying requests without explicitly checking the origin/custom headers.
**Prevention:** Always mandate `verifyCsrf(req)` at the top of every POST, PATCH, PUT, or DELETE Next.js route handler, regardless of additional permission checks.
