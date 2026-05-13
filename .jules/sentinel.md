## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2026-04-24 - IP Spoofing Auth Bypass via x-forwarded-for
**Vulnerability:** The GET /api/admin/metrics endpoint relied on the first entry of the x-forwarded-for header for IP-based authentication bypass, allowing attackers to spoof allowed IP addresses.
**Learning:** The first entry of the x-forwarded-for header is client-controlled and must never be trusted for authentication or rate limiting.
**Prevention:** Always extract the IP address using cf-connecting-ip (if available via Cloudflare) or the last entry of the x-forwarded-for header (which is securely appended by the proxy) instead of the first entry.
