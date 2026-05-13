## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2024-05-13 - IP Spoofing Auth Bypass
**Vulnerability:** Authentication bypass via IP spoofing by trusting the first entry of the x-forwarded-for header.
**Learning:** The first entry of x-forwarded-for is client-controlled and vulnerable to IP spoofing. Prioritize cf-connecting-ip or the last entry of x-forwarded-for.
**Prevention:** Never trust the first entry of x-forwarded-for for authentication or rate-limiting. Use a secure IP extraction utility function.
