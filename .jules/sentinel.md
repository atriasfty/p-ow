## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.

## 2024-05-15 - IP Spoofing via X-Forwarded-For
**Vulnerability:** The metrics endpoint trusted the first entry of the `x-forwarded-for` header for an IP allowlist check, which is client-controlled and easily spoofable.
**Learning:** Never trust `x-forwarded-for`'s first entry for security checks like authentication or rate-limiting.
**Prevention:** Prioritize `cf-connecting-ip` (if using Cloudflare) or extract the *last* entry of `x-forwarded-for` which is securely appended by the proxy.
