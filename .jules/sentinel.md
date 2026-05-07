## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2024-05-24 - [Auth Bypass] IP Spoofing via x-forwarded-for
**Vulnerability:** The admin metrics endpoint trusted the first entry of the `x-forwarded-for` header for authentication bypass, allowing attackers to spoof their IP address.
**Learning:** Client-controlled headers like `x-forwarded-for[0]` should never be trusted for security decisions, as they can be easily manipulated.
**Prevention:** Always prioritize trusted headers like `cf-connecting-ip` (if using Cloudflare) or extract the *last* entry of `x-forwarded-for`, which is appended securely by the proxy.
