## 2025-02-14 - CSRF Vulnerability Pattern
**Vulnerability:** Missing CSRF validation on multiple state-modifying API routes.
**Learning:** The application lacks a centralized CSRF middleware. Instead, it relies on manual `verifyCsrf` calls in each state-modifying API route (POST, PATCH, DELETE). Many routes, especially admin routes, are missing this protection, making them vulnerable to Cross-Site Request Forgery.
**Prevention:** Always ensure that POST, PATCH, DELETE, and PUT routes in `dashboard/src/app/api` include `if (!verifyCsrf(req)) return new NextResponse("Forbidden", { status: 403 })` or similar before performing any actions, unless they are public, vision, or internal API routes that use Bearer tokens or specific headers instead of cookies.
