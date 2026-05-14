## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2023-10-25 - IP Spoofing in Admin Metrics Endpoint
**Vulnerability:** IP spoofing authentication bypass due to trusting the first entry of the x-forwarded-for header.
**Learning:** The first entry of the x-forwarded-for header is client-controlled and vulnerable to IP spoofing. The application should prioritize cf-connecting-ip or the last entry of x-forwarded-for which is appended securely by the proxy.
**Prevention:** Never trust the first entry of x-forwarded-for for authentication or rate-limiting. Use cf-connecting-ip or extract the last entry of x-forwarded-for.
