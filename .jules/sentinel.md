## 2026-04-23 - CSRF Protection in Perm Log
**Vulnerability:** Missing CSRF protection on the POST /api/perm-log endpoint.
**Learning:** State-modifying cookie-based API routes must explicitly call verifyCsrf(req) since there is no system-wide CSRF middleware.
**Prevention:** Ensure all state-modifying cookie-based API routes (POST, PATCH, DELETE, PUT) include verifyCsrf(req) and corresponding frontend requests include the x-csrf-check header.

## 2024-07-26 - Discord Markdown Injection in Logs
**Vulnerability:** Discord markdown injection in command logging
**Learning:** When echoing user input like command parameters and Discord usernames directly into bot messages, failing to sanitize characters like backticks and at-symbols allows for ping injection and code block breakout.
**Prevention:** Strip dangerous markdown characters from user-controlled strings before sending them to Discord.
