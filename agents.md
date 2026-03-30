# Comprehensive Agent Development Guide: Project Overwatch (POW)

This document is the authoritative technical reference for AI agents. It details the system architecture, security protocols, and implementation nuances of Project Overwatch. **Failure to adhere to these guidelines may result in security vulnerabilities or database desynchronization.**

---

## 1. System Architecture & Monorepo Structure

Project Overwatch is composed of three interconnected systems sharing a single source of truth (SQLite).

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

---

## 2. Database & Schema Management (CRITICAL)

The system uses a single SQLite database file located at `dashboard/prisma/dev.db`.

### Synchronization Requirement
The `bot` and `dashboard` directories have **separate** `prisma/schema.prisma` files. 
- **RULE:** If you modify `dashboard/prisma/schema.prisma`, you **MUST** copy the changes to `bot/prisma/schema.prisma`.
- **COMMANDS:** You must run `npx prisma generate` in **both** directories after any schema change.
- **MIGRATIONS:** Always run migrations from the `dashboard` directory. Use `npx prisma db push --accept-data-loss` for rapid prototyping or `npx prisma migrate dev` for formal changes.

---

## 3. Security & Authentication Logic

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

## 4. The Form & Recruitment System

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

## 5. Discord Integration & Bot Logic

### log-syncer.ts
This is the heart of the bot's game-to-web bridge.
- **Rate Limits:** It polls PRC logs. Because SQLite does not support `skipDuplicates: true` in Prisma, you **must** manually deduplicate logs by fetching existing timestamps before calling `createMany`.
- **Commands:** The bot parses raw chat logs for triggers like `:log warn`, `:log shift start`, and `:shutdown`.

### Auto-Join & Sync
- **Auto-Join:** When a user logs in, `performAutoJoin` checks their Discord servers. If they have the `staffRoleId` in a guild registered in POW, it automatically creates a `Member` record for them.
- **Termination:** The `terminatedRoleId` behavior **removes the user from the POW server member list**. It does **not** delete the Clerk account.

---

## 6. Vision API (HMAC Security)

Requests from the Vision desktop app to the Dashboard API (`/api/vision/...`) use a dual-layer security check:
1. **JWT:** Standard Clerk session token.
2. **Signature:** An HMAC-SHA256 signature generated using a shared `VISION_SECRET`.
- **Constraint:** Do not modify the signature verification logic in `vision-auth` or the API routes without updating the Electron `preload.ts` logic.

---

## 7. PWA & Mobile UI

The `PWAGate.tsx` component blocks mobile browser access to force PWA installation.
- **Exemption List:** The following paths are hardcoded to bypass the gate:
  - `/` (Landing)
  - `/login`
  - `/pricing`
  - `/vision-auth`
  - `/forms/[shareId]` (Public filling)
- **Mobile Nav:** The `BottomNav.tsx` is only rendered when `isMobile && isInstalled` is true.

---

## 8. Common Pitfalls & Anti-Patterns

- **Hallucinating UI:** The "Toolbox" does **not** have Kick/Ban buttons. Those are on the **Player Panel**. The Toolbox has: Perm Log, LOA Request, Run Command, Staff Request.
- **Direct DB Access in Bot:** The bot uses the same database but different Prisma client generation. Always verify the bot's `schema.prisma` before writing code that touches `Log` or `Punishment`.
- **Roblox Username Cache:** Many tables store `robloxId`. When displaying usernames, check the `Member` cache or fetch from Clerk. Do not assume the username is always available in the `Punishment` record.
- **Quota Logic:** Quotas are stored in **Minutes** but shifts are recorded in **Seconds**. Divide by 60 for comparison.

---

## 9. Critical Triggers for Automations
- `PLAYER_JOIN` / `PLAYER_LEAVE`
- `COMMAND_USED` (Check `details.command` for patterns)
- `PUNISHMENT_ISSUED` (Triggers on Warn, Kick, Ban, BOLO)
- `TIME_INTERVAL` (Used for scheduled tasks/announcements)

---
*Last verified and detailed: March 5, 2026*
