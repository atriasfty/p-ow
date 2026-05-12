# Self-Hosting

Project Overwatch is open-source software. You are free to self-host it under the terms of the project license.

{% hint style="warning" %}
**Self-hosting is for advanced users.** It requires a working knowledge of Node.js, PostgreSQL, Discord application management, and Linux server administration. If you'd rather skip the setup, the managed service at [**pow.atriasafety.org**](https://pow.atriasafety.org) is maintained by the Atria team and is free for most communities.
{% endhint %}

---

## What you're running

POW is a monorepo with three components that must all run simultaneously and share a single PostgreSQL database:

| Component | Technology | Purpose |
|---|---|---|
| `dashboard` | Next.js 15 | Web UI, REST API, SSE stream |
| `bot` | Discord.js | Log syncing, role management, slash commands |
| `vision` | Electron | Desktop OCR overlay (optional) |

A separate lightweight **sync server** (`dashboard/src/sync-server.js`) runs alongside the dashboard for real-time collaborative state via Yjs WebSockets.

---

## Prerequisites

- **Node.js 20+** and **npm**
- **PostgreSQL 14+** — both the dashboard and bot connect to the same database
- A **Linux VPS or dedicated server** (recommended: 1 GB RAM minimum)
- A **Discord application** with a bot token and a configured OAuth2 redirect
- A **Clerk account** — POW uses [Clerk](https://clerk.com) for authentication (free tier is sufficient for small communities)
- A **PRC API key** from ER:LC for your Roblox server
- **PM2** (or another process manager) to keep all three processes running

---

## High-level setup

1. **Clone the repository** and install dependencies in each workspace:
   ```bash
   git clone https://github.com/atriasafety/project-overwatch.git
   cd project-overwatch
   cd dashboard && npm install
   cd ../bot && npm install
   ```

2. **Configure environment variables.** Each workspace needs its own `.env` file. The required variables are listed in the `.env.example` files at `dashboard/.env.example` and `bot/.env.example`. At minimum you will need credentials for Clerk, Discord, and your PRC API key.

3. **Set up the database.** Provision a PostgreSQL instance and set `DATABASE_URL` in **both** `dashboard/.env` and `bot/.env` — they share the same database. Run migrations and generate the Prisma client in both workspaces:
   ```bash
   cd dashboard && npx prisma migrate deploy && npx prisma generate
   cd ../bot && npx prisma generate
   ```

4. **Build and start** all three processes. The provided `deploy.sh` script is the reference for how the Atria team runs production — review it to understand the expected PM2 configuration.

{% hint style="info" %}
The sync server (`sync-server.js`) must be started as a separate process. It is not part of Next.js.
{% endhint %}

---

## Billing and plan features

POW has three tiers: **Free**, **POW Pro**, and **POW Max**. On the managed service, plans are handled by Clerk Billing. On a self-hosted instance there is no payment integration — you grant plans manually via the superadmin panel instead.

**Setting up the superadmin:**

Set the `SUPER_ADMIN_ID` environment variable to your own Clerk user ID. This gives that account unrestricted access to the superadmin panel at `/admin/super`, where you can set the plan for any server to `pow-max` and grant any user the `pow-max` user plan.

Both must be set for Max features to be fully unlocked — the server plan controls feature availability (raid detection, exports, Vision, white-label bot, etc.), and the user plan controls per-user entitlements like Vision access.

{% hint style="info" %}
There is no subscription or payment flow to configure. The superadmin grant bypasses billing entirely.
{% endhint %}

---

## What the managed service gives you

The self-hosted path gives you full control, but the official instance at **pow.atriasafety.org** handles the following for you automatically:

- Zero-downtime deployments with every update
- Database backups and migrations
- Monitoring and uptime alerting
- Support via the Atria Discord server

Self-hosted instances are on their own for upgrades, migrations, and incident response.

---

## Getting help

**Atria does not provide support for self-hosted instances.** We're a small team and simply don't have the capacity to assist with individual deployments.

For setup and troubleshooting, we recommend using an AI coding agent (Claude, Cursor, etc.) and pointing it at `AGENTS.md` in the root of the repository (note the uppercase filename). That file is the authoritative technical reference for the codebase and was written specifically to give an AI agent enough context to work with POW independently.
