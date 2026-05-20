## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.
## 2024-05-20 - Authentication Bypass via IP
**Vulnerability:** Hardcoded IP-based authentication bypass evaluating the spoofable x-forwarded-for header.
**Learning:** Never trust the first entry of the x-forwarded-for header for authentication or rate-limiting, and avoid hardcoded IP authentication bypasses entirely.
**Prevention:** Ensure standard session-based authentication (e.g., getSession()) is used and enforced for all administrative endpoints, and never implement temporary or hardcoded IP backdoors.
