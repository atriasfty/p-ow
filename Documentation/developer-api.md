---
description: Build custom integrations using the POW Developer API.
---

# Developer API

Project Overwatch provides a robust REST API that allows server administrators to seamlessly hook custom Discord bots, automated workflows, internal dashboards, and external tooling directly into their POW workspace.

## API Documentation Playground

We've built a native, interactive OpenAPI specification environment where you can explore endpoints, view strict typed schemas, and even test live code directly from the browser!

🚀 **[View Official API Documentation](https://pow.ciankelly.xyz/api/docs)**

## API Keys & Authentication

To interact with the API programmatically, you must generate a secure API key from your designated Server Dashboard.

1. Navigate to your Server dashboard, and click the **Admin** panel.
2. Select the **API Keys** section from the sidebar.
3. Click **Generate Key** and securely save the returned secret value.
4. Pass your key as a Bearer Token in your HTTP requests using the `Authorization: Bearer <key>` header.

> ⚠️ **Security Warning**: API keys are shown exactly once upon generation. Be sure to retain the generated secret, and never hardcode it directly into client-side code!

## Rate Limiting & Quotas

The Public API enforces daily rolling quotas to ensure systemic stability across the platform. These quotas scale based on your workspace's active subscription tier:
* **Free Plan**: 250 requests/day
* **Pro Plan**: 5,000 requests/day
* **Max Plan**: Unlimited requests

Every API response embeds standard `X-RateLimit-Remaining` and `X-RateLimit-Reset` HTTP headers so your applications can throttle dynamically. Exceeding boundaries will result in an HTTP `429 Too Many Requests` failure. All usage metrics and statistics can be traced natively from the dashboard's API Keys Panel.
