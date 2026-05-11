## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.

## 2024-05-24 - IP Spoofing via X-Forwarded-For
**Vulnerability:** IP spoofing on the admin metrics endpoint due to trusting the first entry of the `x-forwarded-for` header.
**Learning:** The first entry of `x-forwarded-for` is client-controlled and easily spoofed. This allowed bypassing the IP allowlist check (`isAllowedIp`).
**Prevention:** Prioritize `cf-connecting-ip` (if using Cloudflare) or extract the *last* entry of `x-forwarded-for` which is securely appended by the proxy. Never trust `x-forwarded-for[0]`.
