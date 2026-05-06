## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2024-05-24 - IP Spoofing Authentication Bypass
**Vulnerability:** IP allowlist check in `/api/admin/metrics` used `x-forwarded-for.split(",")[0]`, allowing attackers to spoof their IP and bypass the `isSuperAdmin` authentication check.
**Learning:** The first entry of `x-forwarded-for` is client-controlled. When using IP-based authentication or rate-limiting bypasses, trusting client-controlled headers leads to critical security flaws.
**Prevention:** Always use `cf-connecting-ip` (if on Cloudflare) or extract the *last* entry of `x-forwarded-for` appended by the trusted proxy.
