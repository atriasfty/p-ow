## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2026-04-23 - Predictable Identifier Generation
**Vulnerability:** Predictable identifier generation using Math.random() in the API endpoint.
**Learning:** Using Math.random() for security-sensitive values or identifiers can lead to predictability and potential security risks.
**Prevention:** Always use cryptographically secure random number generators (CSPRNGs) such as crypto.randomUUID() or crypto.randomBytes() to ensure output is unpredictable and collision-resistant.
