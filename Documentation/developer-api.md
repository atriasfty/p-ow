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

## Server Scoping

Each API key is permanently linked to a single POW server workspace. You do **not** need to pass a `server` parameter in your requests — the API automatically resolves your server from the key itself. This means one key = one server, always.

## Field Reference

Different endpoints expect different types of IDs. Here's a quick reference to avoid confusion:

| Field | What It Is | Format | Example |
|---|---|---|---|
| `userId` (Punishments) | **Roblox User ID** of the player being actioned | Numeric string | `"123456789"` |
| `moderatorId` | **Roblox User ID** of the staff member issuing the action | Numeric string | `"987654321"` |
| `userId` (Shifts) | **Clerk User ID** — the staff member's POW account ID | String with prefix | `"user_2xABC..."` |
| `serverId` | Internal POW server identifier (returned in responses) | CUID string | `"clx1a2b3c..."` |
| `id` (Player) | **Roblox User ID** of an online player | Numeric string | `"123456789"` |

> ⚠️ **Important**: The `userId` field has **different meanings** depending on the endpoint! For **Punishments**, it refers to the target player's **Roblox User ID**. For **Shifts**, it refers to the staff member's **Clerk (POW) account ID**. Always check the interactive docs for per-endpoint details.

## Available Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/servers` | Get your server's metadata |
| `GET` | `/players` | List online players (live game data) |
| `GET` | `/stats` | Live server statistics |
| `GET` | `/members` | List all staff members |
| `GET` | `/members/lookup?robloxId=...` | Look up a staff member's Clerk ID by Roblox ID |
| `GET` | `/punishments?userId=...` | List punishment history |
| `POST` | `/punishments` | Log a new punishment |
| `GET` | `/punishments/active` | List all active (unresolved) Ban BOLOs |
| `GET` | `/shifts/status?userId=...` | Check if a staff member is on duty |
| `POST` | `/shifts/start` | Start a shift |
| `POST` | `/shifts/end` | End an active shift |
| `GET` | `/shifts/history?userId=...&days=7` | Get completed shift history with total hours |
| `GET` | `/shifts/leaderboard?days=7&limit=10` | Staff leaderboard ranked by shift hours |
| `POST` | `/commands` | Execute a PRC server command |

> 💡 **Tip**: Use `/members/lookup` to convert a Roblox ID into a Clerk user ID, then pass that to the Shift endpoints. This is the recommended flow for Discord bots that need to track staff shifts by their Roblox identity.
