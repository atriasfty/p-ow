# Sentinel Security Journal

## 2026-04-02 - Restricted Vision API CORS Policy
- Fixed an overly permissive CORS policy (`*`) in the Vision API routes that could expose the API to CSRF or unauthorized cross-origin requests. Restricted allowed origins dynamically using `getVisionCorsHeaders` to whitelist the App URL, localhost (3000 and 5173), and the `null` origin for Electron's `file://` protocol.
