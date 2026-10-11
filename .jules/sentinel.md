## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2024-05-24 - Cryptographically Secure Random Identifiers
**Vulnerability:** Predictable identifier generation using `Math.random()`.
**Learning:** `Math.random()` was used for generating `requestId` in API routes, which is non-cryptographic and can be guessed, leading to predictable tracking or session correlation.
**Prevention:** Always use cryptographically secure random number generators like `crypto.randomUUID()` or `crypto.randomBytes()` from the native `crypto` API when generating identifiers.
