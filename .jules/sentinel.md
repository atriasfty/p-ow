## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.

## 2024-05-07 - IP Spoofing Authentication Bypass
**Vulnerability:** The admin metrics API route used the first entry of the `x-forwarded-for` header for authentication bypass, which is client-controlled and trivial to spoof.
**Learning:** Hardcoded IP checks for administrative routes must not trust `x-forwarded-for[0]`, as it can lead to direct unauthenticated access to sensitive data if an attacker sends a crafted header.
**Prevention:** Always use `cf-connecting-ip` (if behind Cloudflare) or extract the LAST entry of `x-forwarded-for` (appended by the trusted reverse proxy) when verifying client IPs for security decisions.
