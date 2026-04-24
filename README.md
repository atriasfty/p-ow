### Atria is a fiscally sponsored 501(c)(3) non-profit.
### Thanks to The Hack Foundation, d.b.a. Hack Club.

---

# Project Overwatch (POW)

A comprehensive moderation platform for Roblox ER:LC communities, featuring a real-time dashboard, Discord bot integration, and desktop overlay tool.

## 🏗️ Architecture

This is a monorepo containing three main components:

```
p-ow/
├── dashboard/    # Next.js web dashboard
├── bot/          # Discord bot
└── vision/       # Electron desktop overlay (POW Vision)
```

### Dashboard (`/dashboard`)
- **Stack**: Next.js 14, React, Tailwind CSS, Prisma (SQLite)
- **Auth**: Clerk
- **Features**: 
  - Real-time mod panel with player search
  - Punishment logging and history
  - Staff activity tracking
  - Server management
  - API key management for external integrations

### Bot (`/bot`)
- **Stack**: Discord.js
- **Features**:
  - Slash commands for server info and management
  - Automatic log syncing with the dashboard
  - Integration with PRC (Police Roleplay Community) API

### Vision (`/vision`)
- **Stack**: Electron, React, Vite
- **Features**:
  - Always-on-top overlay for in-game moderation
  - OCR-based player identification using AI (Mistral)
  - Quick punishment actions (Warn, Kick, Ban, BOLO)
  - System tray support with hotkey toggle


---

Built with ❤️ by the Atria Team
