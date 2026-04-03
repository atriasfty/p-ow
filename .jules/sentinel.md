## 2024-03-31 - Overly Permissive CORS Policy in Vision API
**Vulnerability:** The Vision API routes (`/api/vision/*`) were configured with `Access-Control-Allow-Origin: *`, allowing requests from any domain.
**Learning:** This occurred because the Electron desktop application required access from `file://` protocol (which evaluates to a `null` origin) and local development needed access from `localhost:5173`. Instead of explicitly whitelisting these origins alongside the production web app, a wildcard was used as a shortcut.
**Prevention:** Always implement dynamic evaluation of the `Origin` header against a strict, predefined whitelist of allowed domains/protocols when supporting complex client architectures (like Electron + Web) instead of falling back to a wildcard.
## 2026-04-02 - CSRF Protection in API routes
State-modifying API routes (POST, PATCH, DELETE) in the Next.js dashboard must be protected against Cross-Site Request Forgery (CSRF) by using the `verifyCsrf(req)` helper from `@/lib/auth-permissions`. Requests failing this check should immediately return a 403 Forbidden response. This prevents attackers from forcing authenticated users' browsers to send unwanted requests to these endpoints.
## 2024-04-03 - Next.js App Router CSRF Protection Gap
**Vulnerability:** Several state-modifying endpoints (POST, PATCH, DELETE) in the Next.js API Routes (like admin grant/revoke endpoints) lacked Cross-Site Request Forgery (CSRF) protection.
**Learning:** In Next.js App Router, cookie-based API routes (`route.ts`) do not inherently inherit the default CSRF protections of Next.js Server Actions. They require explicit verification.
**Prevention:** Always explicitly call `verifyCsrf(req)` at the beginning of state-modifying requests in Next.js API routes and reject unverified requests with a 403 Forbidden status.
