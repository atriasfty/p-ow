# Comprehensive Agent Development Guide: Project Overwatch (POW)

This document is the authoritative technical reference for AI agents. It details the system architecture, security protocols, and implementation nuances of Project Overwatch. **Failure to adhere to these guidelines may result in security vulnerabilities or database desynchronization.**

---

## 1. System Architecture & Monorepo Structure

Project Overwatch is composed of three interconnected systems sharing a single source of truth (PostgreSQL).

### `/dashboard` (Next.js 15+, Tailwind, Lucide)
- **Role:** Central management hub, API provider, and PWA host.
- **Key Tech:** Clerk (Auth), Prisma (ORM), Next.js App Router.
- **Entry Point:** `dashboard/src/app/page.tsx`.

### `/bot` (Node.js, TypeScript, Discord.js)
- **Role:** Real-time bridge between Roblox game servers and Discord.
- **Responsibility:** In-game command processing, log syncing (joins/kills/commands), and automated role management.
- **Entry Point:** `bot/src/index.ts`.

### `/vision` (Electron, React, Tesseract.js)
- **Role:** Desktop HUD for Roblox players.
- **Mechanism:** Screen capture + OCR to detect usernames, fetching player history via HMAC-signed API calls.

### CI/CD Deployment Architecture (CRITICAL)
POW strictly enforces a zero-downtime, dual-environment Git deployment via `./deploy.sh [target]`.
- **Production (`./deploy.sh prod`):** `main` branch → `https://pow.atriasafety.org`, port 41729.
- **Staging (`./deploy.sh staging`):** `staging` branch → `https://staging.atriasafety.org`, port 41731.
- PM2 processes automatically inject environment tags (e.g. `pow-dashboard-staging`) to prevent cross-process collisions.
- **NEVER** instruct the user to upload `Archive.zip`. The deploy script authentically uses `git fetch` and `--hard reset` natively on the VPS.

### PM2 Process Map
| PM2 name | Entrypoint | Port | Health check |
|---|---|---|---|
| `pow-dashboard-{env}` | `npm run start` (Next.js) | 41729 prod / 41731 staging | `GET /api/health` |
| `pow-sync-{env}` | `node src/sync-server.js` | 41730 | `GET :41730/health` |
| `pow-bot-{env}` | `npm run start` (ts-node) | — | `GET :41732/health` |

The sync server (`dashboard/src/sync-server.js`) is a standalone Yjs WebSocket server. It is **not** part of Next.js. WebSocket connections require a valid `?token=<INTERNAL_SYNC_SECRET>` query param or they are closed with code 4001.

---

## 2. Database & Schema Management (CRITICAL)

The database is **PostgreSQL**. The production database is remote and NOT accessible from the local machine. Local development uses a local PostgreSQL instance pointed to by `DATABASE_URL` in `dashboard/.env` and `bot/.env`.

### Synchronization Requirement
The `bot` and `dashboard` directories have **separate** `prisma/schema.prisma` files.
- **RULE:** If you modify `dashboard/prisma/schema.prisma`, you **MUST** copy the changes to `bot/prisma/schema.prisma`.
- **COMMANDS:** You must run `npx prisma generate` in **both** directories after any schema change.

### Migrations (CRITICAL RULE)
**NEVER** use `npx prisma db push` or `npx prisma migrate dev`. The production deployment (`deploy.sh`) exclusively uses `npx prisma migrate deploy`.

**EVERY schema change requires manually creating a migration folder + SQL file:**
```
dashboard/prisma/migrations/<YYYYMMDDHHMMSS>_<migration_name>/migration.sql
```

The SQL must contain the exact DDL statements (e.g., `ALTER TABLE`, `CREATE TABLE`). `migrate deploy` will apply any unapplied folders in order.

---

## 3. Real-Time Architecture (SSE)

All live data on the mod panel flows through a single **Server-Sent Events (SSE)** connection, not HTTP polling.

### How it works
1. `src/lib/log-syncer.ts` polls the PRC API every ~4 seconds and writes to the database.
2. When new data is detected, it emits events via `eventBus` (`src/lib/event-bus.ts`).
3. `src/app/api/sse/[serverId]/route.ts` streams these events to the client.
4. `src/components/providers/server-events-provider.tsx` wraps the mod panel and exposes the data via React context.

### SSE Context Hooks (IMPORTANT)
- **`useServerEventsContext()`** — throws if used outside `<ServerEventsProvider>`. **Only use inside mod-panel components.**
- **`useServerEventsContextSafe()`** — returns `null` if outside the provider. **Use this in shared components** like `LogViewer` that can be rendered on multiple pages.

---

## 4. Mod Call Panel

Automatically opens for the responding moderator when they reply to a mod call in-game.

### Detection Flow
1. PRC API returns `ModCalls` as: `{ Caller: "name:robloxId", Moderator: "name:robloxId", Timestamp: number }`.
2. `log-syncer.ts` matches the `Moderator` field to an existing `ModCall` DB record and updates its `respondingPlayers` column (JSON string array of Roblox IDs).
3. The updated `ModCall` list is pushed over SSE to all connected clients.
4. `ModCallDetector` component watches the SSE `calls` event and checks if `session.user.robloxId` is in `respondingPlayers`.
5. If found, `ModCallPanel` opens with a 45° diagonal wipe animation.

### modcall-context API (`/api/modcall-context`)
Authenticated endpoint. Returns: call details, nearby players (within ±2 min & 200 game units from the call's coordinates), current live positions of all involved players, and filtered logs (±5 min, only involving those players).

---

## 5. Security & Authentication Logic

### Identity (Clerk)
- Never use local user tables for auth. Always use `clerkClient` and `getSession()`.
- **User IDs:** Clerk IDs look like `user_...`.
- **External Accounts:** Roblox usernames are found in `externalAccounts` where provider is `oauth_custom_roblox`. **Note:** This is an array; index 0 is usually primary.

### Permissions Hierarchy
Permissions are calculated using `dashboard/src/lib/admin.ts`. The order of operations is:
1. **Superadmin:** Hardcoded ID check (`SUPER_ADMIN_ID`).
2. **Server Owner:** Checked via `Server.subscriberUserId` or explicit ownership record.
3. **Server Admin:** Users with `Member.isAdmin = true` for that specific `serverId`.
4. **Staff/Viewer:** Users with the matching `Server.staffRoleId` in Discord.

### Tenant Isolation
**EVERY** API route that takes a `serverId` or `formId` parameter must validate that the authenticated user belongs to that server.
- **Correct Pattern:**
  ```typescript
  const session = await getSession();
  const hasAccess = await isServerAdmin(session.user, serverId);
  if (!hasAccess) return new NextResponse("Forbidden", { status: 403 });
  ```

---

## 6. The Form & Recruitment System

### Per-Form Logic
Settings that used to be global are now **per-form**. Do not add these to the `Server` model:
- `isApplication`: Boolean toggle to enable the recruitment workflow.
- `recruitmentChannelId`: Discord channel for submission embeds.
- `acceptedRoleId`: Discord role granted upon clicking "Accept" in the results.
- `congratsChannelId`: Discord channel for promotion announcements.

### Submission Workflow
Located in `api/forms/[formId]/submit/route.ts`.
- **Drafts:** Users can save drafts. The frontend sends a `responseId`. If present, use `upsert` to update the existing record.
- **Conditional Validation:** If a form question is hidden via `conditions`, you **must not** throw a validation error if it is empty, even if marked as `required`.

---

## 7. Discord Integration & Bot Logic

### PRC API
- **Root domain:** `api.erlc.gg` (changed from `api.policeroleplay.community`).
- Dashboard uses **v2**: constant `PRC_BASE_URL` in `dashboard/src/lib/config.ts`.
- Bot uses **v1**: constant `BASE_URL` in `bot/src/lib/prc.ts`.
- Never hardcode the domain outside these two constants.

### log-syncer.ts
This is the heart of the bot's game-to-web bridge.
- **Deduplication:** It polls PRC logs and manually deduplicates them by fetching existing timestamps before calling `createMany`. Do not remove this logic — the PRC API returns overlapping windows and duplicates will appear if deduplication is skipped.
- **Commands:** The bot parses raw chat logs for triggers like `:log warn`, `:log shift start`, and `:shutdown`.
- **ModCalls:** The PRC REST API returns `{ Caller, Moderator, Timestamp }` for mod calls. There is NO `Players` array on mod calls from the REST API.

### Auto-Join & Sync
- **Auto-Join:** When a user logs in, `performAutoJoin` checks their Discord servers. If they have the `staffRoleId` in a guild registered in POW, it automatically creates a `Member` record for them.
- **Termination:** The `terminatedRoleId` behavior **removes the user from the POW server member list**. It does **not** delete the Clerk account.

---

## 8. Vision API (HMAC Security)

Requests from the Vision desktop app to the Dashboard API (`/api/vision/...`) use a dual-layer security check:
1. **JWT:** Standard Clerk session token.
2. **Signature:** An HMAC-SHA256 signature generated using a shared `VISION_SECRET`.
- **Constraint:** Do not modify the signature verification logic in `vision-auth` or the API routes without updating the Electron `preload.ts` logic.

---

## 9. PWA & Mobile UI

The `PWAGate.tsx` component blocks mobile browser access to force PWA installation.
- **Exemption List:** The following paths are hardcoded to bypass the gate:
  - `/` (Landing), `/login`, `/pricing`, `/vision-auth`, `/forms/[shareId]`
- **Mobile Nav:** The `BottomNav.tsx` is only rendered when `isMobile && isInstalled` is true.

---

## 10. Subscription & Plan System

Plans are defined in `dashboard/src/lib/subscription.ts`. There are two independent plan states:

### Server plan (`Server.subscriptionPlan` in DB)
Values: `null` (free) | `'pow-pro'` | `'pow-max'`
Controls feature availability for all users of that server (raid detection, exports, Vision, white-label bot, automations limits, etc.).

### User plan (Clerk `publicMetadata.subscriptionPlan`)
Values: `null` (free) | `'pow-pro-user'` | `'pow-pro'` | `'pow-max'`
Controls per-user entitlements such as Vision access. Read via `getUserPlan()` in `subscription.ts`.

### How plans are set
On the managed service, Clerk Billing webhooks populate these. Both can also be set by the superadmin (hardcoded `SUPER_ADMIN_ID` in `admin.ts`) via:
- `adminGrantServerPlan()` — sets `Server.subscriptionPlan` directly in the DB
- `adminGrantUserPlan()` — sets Clerk user `publicMetadata.subscriptionPlan`

The superadmin panel at `/admin/super` exposes UI for both. Superadmin grants bypass Clerk Billing entirely.

### Checking access
Always use `getServerPlan(serverId)` or `getUserPlan(userId)` from `subscription.ts` — never read `subscriptionPlan` directly from the DB in feature-gate logic, as the helpers apply the correct fallback defaults.

---

## 11. Common Pitfalls & Anti-Patterns

- **Never create unauthenticated API routes.** Every route must call `getSession()` and validate the user's server membership if a `serverId` is involved.
- **Hallucinating UI:** The "Toolbox" does **not** have Kick/Ban buttons. Those are on the **Player Panel**. The Toolbox has: Perm Log, LOA Request, Run Command, Staff Request.
- **Direct DB Access in Bot:** The bot uses the same database but different Prisma client generation. Always verify the bot's `schema.prisma` before writing code that touches `Log` or `Punishment`.
- **Roblox Username Cache:** Many tables store `robloxId`. When displaying usernames, check the `Member` cache or fetch from Clerk. Do not assume the username is always available in the `Punishment` record.
- **Quota Logic:** Quotas are stored in **Minutes** but shifts are recorded in **Seconds**. Divide by 60 for comparison.
- **SSE Context:** Never use `useServerEventsContext()` in components that are rendered outside the mod panel. Use `useServerEventsContextSafe()` instead.
- **UI Terminology:** The word "departments" has been removed from the UI. Always use "servers" — never "departments".
- **Root domain:** `pow.atriasafety.org`. Do not reference `pow.ciankelly.xyz` anywhere in code or copy. Staging is `staging.atriasafety.org`.
- **Clerk:** Auth is scoped to `atriasafety.org`. The publishable key encodes the domain — never copy a key from one environment to another.

---

## 12. Critical Triggers for Automations
- `PLAYER_JOIN` / `PLAYER_LEAVE`
- `COMMAND_USED` (Check `details.command` for patterns)
- `PUNISHMENT_ISSUED` (Triggers on Warn, Kick, Ban, BOLO)
- `TIME_INTERVAL` (Used for scheduled tasks/announcements)
- `MOD_CALL` (Triggered when a new mod call is created)
- `EMERGENCY_CALL` (Triggered when a new 911 call is created)

---

## 13. Observability & Monitoring

Self-hosted Prometheus + Grafana + Loki + Alertmanager, running in production. Two distinct pieces:

1. **App-level metrics/tracing code** — lives in the normal repo, deploys with everything else.
   - `dashboard/src/lib/prometheus.ts`, `bot/src/lib/prometheus.ts` — `prom-client` registries. `/api/metrics` (dashboard, Next.js route) and `/metrics` (bot and `sync-server.js`, plain `http.createServer` branches) are scrape endpoints, gated behind `PROMETHEUS_METRICS_SECRET` as a Bearer token (timing-safe compare, mirrors `INTERNAL_SYNC_SECRET`'s existing pattern).
   - `dashboard/src/lib/metrics.ts` — `trackApiCall` / `trackSyncCycle` / `trackDbQuery` write straight into Prometheus histograms/counters now. Same function signatures as before, so every existing call site (`prc.ts`, `rotector.ts`, `auth-clerk.ts`, `db.ts`, `api-metrics.ts`, the sync route) is unchanged. **Do not** reintroduce sampling/buffering here — that existed only to survive PostHog's old event quota, and Prometheus doesn't need it. PostHog still owns exception tracking (`errors.ts`) — untouched by this.
   - `dashboard/src/lib/request-context.ts` — a per-sync-cycle correlation ID via `AsyncLocalStorage`. Not distributed tracing — `logger.ts` just picks it up automatically for any log call made inside `runWithCorrelationId(id, fn)`, so a Loki query on `correlationId` reconstructs one server's PRC-poll → DB-write → SSE-emit chain.
   - `dashboard/src/app/api/internal/infra-alert/route.ts` — receives Alertmanager's webhook for infra-only alerts (host mem/disk, PM2 process down), internal-secret gated like `/api/internal/sync`, and forwards through the existing `sendAlert()` in `alerting.ts` onto a **separate** `INFRA_ALERT_DISCORD_WEBHOOK_URL` channel from app alerts (`ALERT_DISCORD_WEBHOOK_URL`) — pass `sendAlert({..., channel: "infra"})`. One cooldown/dedup system, two Discord destinations. All `sendAlert()` messages are prefixed with `@everyone` in the message content so they actually page someone.

2. **The observability stack itself** (`observability/`) — Docker Compose (Prometheus, Grafana, Loki, Promtail, Alertmanager, node_exporter), Grafana dashboards, alert rules, `setup.sh`. This is infrastructure, not app code — **do not deploy it via `deploy.sh` or place it inside the blue-green release tree.** It must live at a stable path outside `releases/<ts>/` and `current-{env}/` (e.g. `/root/pow-observability/`) because `deploy.sh`'s symlink swap on every deploy silently orphans anything bind-mounted from inside that tree — containers keep running against a directory `current-{env}` no longer points to, and `.env`/local edits vanish from view. `setup.sh` warns if it detects it's running from a release-tree path. After a config change lands in git: `rsync` the `observability/` dir to the stable path, then `docker compose up -d` (no-op if only a bind-mounted file's *contents* changed and the service definition didn't — use `docker compose restart <service>` for that case).
   - PagerDuty was deliberately skipped for this integration — there's a pre-existing PagerDuty setup reserved for major outages only, and duplicating that wasn't wanted.
   - `observability/scripts/pm2-restart-count.sh` (cron, `* * * * *`) is the only thing that surfaces PM2 crash-loops — feeds `pow_pm2_restart_total` into node_exporter's textfile collector.

---
*Last updated: August 13, 2026*
