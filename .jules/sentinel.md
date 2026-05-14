## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2024-05-14 - IP Spoofing in Admin Metrics
**Vulnerability:** The admin metrics endpoint trusted the first entry of the x-forwarded-for header for an IP-based bypass, allowing potential attackers to spoof their IP address.
**Learning:** The first entry of x-forwarded-for is client-controlled and cannot be trusted for authentication or rate-limiting.
**Prevention:** Prioritize cf-connecting-ip and extract the last entry of x-forwarded-for (which is appended securely by our proxy) to prevent IP spoofing.
