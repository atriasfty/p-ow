## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.

## 2026-04-23 - Widespread Missing CSRF Protection
**Vulnerability:** Several state-modifying cookie-based endpoints (like `/api/admin/automations`) were missing CSRF protection checks (`verifyCsrf(req)`).
**Learning:** This is a recurring issue. The lack of a system-wide or middleware-enforced CSRF protection mechanism makes it easy to forget these critical checks on individual state-modifying APIs. Any new or existing API route making mutations needs manual verification that this protection is present.
**Prevention:** Consider introducing centralized CSRF enforcement middleware or adding linting rules/checks specifically searching for POST/PATCH/DELETE exports that do not contain `verifyCsrf` inside them.
