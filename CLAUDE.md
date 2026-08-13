# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Overwatch (POW) is a moderation platform for Roblox ER:LC communities. It is a monorepo owned and operated by Atria (a 501(c)(3) non-profit) and **is not intended to be deployed on other systems**.

Three components share a single SQLite database:
- **`/dashboard`** — Next.js 15 web app (mod panel, API, PWA)
- **`/bot`** — Discord.js bot (log syncing, slash commands, role management)
- **`/vision`** — Electron desktop overlay (OCR-based player identification)

## Commands

### Dashboard
```bash
cd dashboard && npm run dev        # Dev server (port varies)
cd dashboard && npm run build      # Production build
cd dashboard && npm run lint       # ESLint
cd dashboard && npm test           # Jest tests
cd dashboard && npx prisma studio  # Browse local DB
```

### Bot
```bash
cd bot && npm run start            # Run bot with ts-node
cd bot && npm run build            # TypeScript compile
cd bot && npm run deploy           # Sync slash commands with Discord
cd bot && npm test                 # Jest tests
```

### Vision
```bash
cd vision && npm run dev           # Dev (Vite + Electron concurrently)
cd vision && npm run build:mac     # Build macOS app
cd vision && npm run build:win     # Build Windows app
```

### Root (run both dashboard + bot)
```bash
npm run dev   # concurrently runs dashboard + bot
```

### Running a single test file
```bash
cd dashboard && npx jest path/to/file.test.ts
cd bot && npx jest path/to/file.test.ts
```

## Database & Schema Management (CRITICAL)

### Two schema files must stay in sync
Both `dashboard/prisma/schema.prisma` and `bot/prisma/schema.prisma` exist separately. **Any change to one must be applied to the other.** After any schema change, run `npx prisma generate` in **both** directories.

### Migrations — never use `db push` or `migrate dev`
The production deploy exclusively uses `npx prisma migrate deploy`. Every schema change requires manually creating a migration file:
```
dashboard/prisma/migrations/<YYYYMMDDHHMMSS>_<migration_name>/migration.sql
```
Write the exact DDL (`ALTER TABLE`, `CREATE TABLE`, etc.) in that file. `migrate deploy` applies unapplied folders in order.

### Local vs production DB
- `dashboard/prisma/dev.db` — local development only
- Production DB is remote (not accessible locally): `/root/data/pow.db` (prod) and `/root/data/pow-staging.db` (staging)

## Deployment

Use `./deploy.sh [prod|staging]` — zero-downtime blue-green deployment via PM2 and a `current` symlink.
- **prod**: `main` branch, `https://pow.atriasafety.org`, port 41729, `pow.db`
- **staging**: `staging` branch, `https://staging.atriasafety.org`, port 41731, `pow-staging.db`

Never instruct the user to upload `Archive.zip` — the deploy script uses `git fetch` + `git reset --hard` on the VPS directly.

### PM2 processes & ports
| Process | Port | Health endpoint |
|---|---|---|
| `pow-dashboard-{env}` | 41729 (prod) / 41731 (staging) | `GET /api/health` |
| `pow-sync-{env}` | 41730 | `GET :41730/health` |
| `pow-bot-{env}` | — | `GET :41734/health` (41735 staging) — `BOT_HEALTH_PORT`, deliberately not 41732 (collides with staging's `SYNC_PORT`) |

## Observability

Self-hosted Prometheus + Grafana + Loki + Alertmanager, live in production. Metrics recording lives in app code (deploys with the rest of the app); the observability stack itself is separate infrastructure.

- **`observability/`** — docker-compose stack, Grafana dashboards/provisioning, Prometheus scrape config + alert rules, Alertmanager config, Promtail log-shipping config, `setup.sh`.
- **CRITICAL: deploy this stack to a stable path OUTSIDE the blue-green release tree** — e.g. `/root/pow-observability/`, never `current-{env}/observability` or `releases/<ts>/observability`. `deploy.sh`'s symlink swap on every deploy orphans anything bind-mounted from inside the release tree (containers keep running against a directory `current-{env}` no longer points to). `setup.sh` warns at runtime if launched from a dangerous path. After config changes land in git, `rsync` them to the stable path and `docker compose up -d` (or `restart <service>` if only a bind-mounted file's *contents* changed — `up -d` is a no-op when the compose service definition itself is unchanged).
- **`dashboard/src/lib/prometheus.ts`**, **`bot/src/lib/prometheus.ts`** — `prom-client` registries. `/api/metrics` (dashboard) and `/metrics` (bot, sync-server) are scraped by Prometheus, gated behind `PROMETHEUS_METRICS_SECRET` (`Authorization: Bearer <secret>`, timing-safe compare — same pattern as `INTERNAL_SYNC_SECRET`).
- **`dashboard/src/lib/metrics.ts`** — `trackApiCall`/`trackSyncCycle`/`trackDbQuery` now record directly into Prometheus histograms/counters (no sampling/buffering — that existed only to survive PostHog's old event quota). Call sites are unchanged from before this migration. PostHog still handles exception tracking (`errors.ts`) — that's untouched.
- **`dashboard/src/lib/request-context.ts`** — lightweight per-sync-cycle correlation ID via `AsyncLocalStorage`, not full distributed tracing. `logger.ts` picks it up automatically for any log call made inside `runWithCorrelationId()`. Search Loki on `correlationId` to reconstruct one server's PRC-poll → DB-write → SSE-emit chain.
- **Alerting**: Prometheus Alertmanager → `dashboard/src/app/api/internal/infra-alert/route.ts` (internal-secret gated, same pattern as `/api/internal/sync`) → the existing `sendAlert()` in `alerting.ts`, on a separate `INFRA_ALERT_DISCORD_WEBHOOK_URL` channel from app-level alerts (`ALERT_DISCORD_WEBHOOK_URL`). One flood-control/cooldown system, two Discord destinations — pass `channel: "infra"` to `sendAlert()` to route there. PagerDuty was deliberately skipped (already covered elsewhere for major outages only).
- **`observability/scripts/pm2-restart-count.sh`** — cron job (`* * * * *`) feeding PM2 restart counts into node_exporter's textfile collector; nothing else surfaces PM2 crash-loops.

## Architecture

### Real-Time Data Flow (SSE)
All live mod panel data flows via Server-Sent Events — not polling:
1. `dashboard/src/lib/log-syncer.ts` polls PRC API every ~4 seconds, writes to DB
2. New data emits events via `dashboard/src/lib/event-bus.ts`
3. `dashboard/src/app/api/sse/[serverId]/route.ts` streams events to clients
4. `dashboard/src/components/providers/server-events-provider.tsx` exposes data via React context

**SSE hook rule:** Use `useServerEventsContext()` only inside mod-panel components. Use `useServerEventsContextSafe()` in shared components (returns `null` if outside provider).

### Auth & Permissions
Auth is handled by Clerk — never use local user tables. `getSession()` is the entry point for server-side auth.

Permission hierarchy (evaluated in order):
1. **Superadmin** — hardcoded ID in `dashboard/src/lib/admin.ts`
2. **Server Owner** — `Server.subscriberUserId`
3. **Server Admin** — `Member.isAdmin = true` for that `serverId`
4. **Staff/Viewer** — matching `Server.staffRoleId` in Discord

Every API route that takes `serverId` or `formId` must validate the user belongs to that server:
```typescript
const session = await getSession();
const hasAccess = await isServerAdmin(session.user, serverId);
if (!hasAccess) return new NextResponse("Forbidden", { status: 403 });
```

### Vision API Security (HMAC)
Requests from the Vision Electron app use dual-layer auth: Clerk JWT + HMAC-SHA256 signature using a shared `VISION_SECRET`. Do not modify signature verification in `vision-auth` without updating `preload.ts` in the Electron app.

### Bot Services
- `log-syncer.ts` — polls PRC API, deduplicates logs manually (SQLite Prisma lacks `skipDuplicates`), parses chat commands (`:log warn`, `:log shift start`, `:shutdown`)
- `role-sync.ts` — auto-syncs Discord roles to POW member records
- `bot-queue.ts` — processes outbound Discord messages/DMs queued by the dashboard
- `server-cleanup.ts` — enforces 24h deletion policy when bot is removed from a guild

### Key `lib/` files (dashboard)
| File | Purpose |
|---|---|
| `db.ts` | Singleton Prisma client with query metrics middleware |
| `admin.ts` | Permission helpers, `SUPER_ADMIN_ID`, `isServerAdmin()` |
| `prc.ts` | `PrcClient` — rate-limited PRC API wrapper (base URL from `config.ts`) |
| `security.ts` | IP ban checking + rate limiting for API routes |
| `log-syncer.ts` | PRC polling loop, SSE event emission |
| `event-bus.ts` | In-process event bus for SSE |
| `auth-clerk.ts` | `getSession()` — wraps Clerk with Roblox/Discord identity |

### Sync server (`dashboard/src/sync-server.js`)
Separate Node.js process (`pow-sync-{env}`) running a Yjs WebSocket server on port 41730. Authenticated via `INTERNAL_SYNC_SECRET` query param. Not part of Next.js — runs alongside it via PM2.

### PRC API
Base domain is `api.erlc.gg`. The dashboard uses v2 (`config.ts → PRC_BASE_URL`), the bot uses v1 (`bot/src/lib/prc.ts → BASE_URL`). Both are sourced from those constants — do not hardcode the domain elsewhere.

## Common Pitfalls

- **Never create unauthenticated API routes.** Every route must validate server membership when a `serverId` is involved.
- **Quota math:** Quotas stored in **minutes**, shifts recorded in **seconds** — divide by 60 to compare.
- **Toolbox ≠ Player Panel:** The Toolbox has Perm Log, LOA Request, Run Command, Staff Request. Kick/Ban buttons are on the Player Panel.
- **Roblox username:** Many tables store only `robloxId`. Check `Member` cache or Clerk `externalAccounts` — do not assume the username is in the `Punishment` record.
- **Form conditional validation:** If a question is hidden by `conditions`, do not throw a validation error even if it is `required`.
- **ModCalls from PRC REST API:** Returns `{ Caller, Moderator, Timestamp }` — there is no `Players` array.
- **Termination behavior:** `terminatedRoleId` removes the user from the POW member list; it does not delete their Clerk account.
- **Bot Prisma:** The bot has its own Prisma client generation. Always verify `bot/prisma/schema.prisma` is in sync before writing bot code that touches shared models.
- **UI terminology:** "Departments" has been removed from the UI. Use "servers" only.
- **Clerk domain:** Auth is scoped to `atriasafety.org` — `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` encodes this. Do not reference `pow.ciankelly.xyz` anywhere.
