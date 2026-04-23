## 2025-02-14 - Fix missing CSRF protection on automations API
**Vulnerability:** The `/api/admin/automations` route lacked CSRF protection (`verifyCsrf`) for its `POST` and `DELETE` handlers.
**Learning:** Even internal admin-only APIs must be explicitly protected against Cross-Site Request Forgery because Next.js has no system-wide CSRF middleware.
**Prevention:** Always verify that state-modifying endpoints (POST, PATCH, DELETE, PUT) inside `app/api/*` that rely on cookie-based authentication explicitly call `verifyCsrf(req)` from `@/lib/auth-permissions`. Ensure corresponding client fetch requests include the `x-csrf-check: '1'` header.
