## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2025-05-18 - Math.random() used for cryptographically secure values
**Vulnerability:** Found `Math.random()` being used to generate a `requestId` in a security log.
**Learning:** `Math.random()` is not a cryptographically secure pseudo-random number generator (CSPRNG) and its values can be predicted.
**Prevention:** Use `crypto.randomUUID()` or `crypto.getRandomValues()` when generating identifiers or tokens that require unpredictability.
