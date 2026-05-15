## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2024-05-15 - IP Spoofing in Admin Metrics Authentication Bypass
**Vulnerability:** The admin metrics endpoint extracted the first element of `x-forwarded-for` to authenticate an allowlisted IP, allowing attackers to spoof their IP and bypass admin authentication.
**Learning:** `x-forwarded-for` can be easily spoofed by clients. Only `cf-connecting-ip` or the last element of `x-forwarded-for` appended by a trusted proxy should be used.
**Prevention:** Always use `cf-connecting-ip` first, fallback to the last entry of `x-forwarded-for`, and never trust the first entry for authentication or rate limiting.
