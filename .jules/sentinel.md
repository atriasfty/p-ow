## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.

## 2026-04-30 - Insecure Randomness in Request IDs
**Vulnerability:** Use of Math.random() for generating unique identifiers (request IDs) in API routes.
**Learning:** Math.random() is not a cryptographically secure pseudo-random number generator (CSPRNG) and its outputs can be predictable, potentially leading to identifier collisions or predictability if used for security-sensitive operations.
**Prevention:** Always use CSPRNGs like crypto.randomUUID() or crypto.getRandomValues() for generating unique identifiers, tokens, or any security-sensitive values.
