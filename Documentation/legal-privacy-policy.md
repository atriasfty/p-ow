# Privacy Policy

**Last Updated: May 6, 2026**

***

### 1. The Short Version

We built Project Overwatch to help Roblox communities run better moderation — not to harvest data. We collect what we need to make the platform work, we keep it on our own servers, we don't sell it to anyone, and we don't share it with advertisers. Full stop.

The sections below explain exactly what we collect and why, in plain English.

***

### 2. Who This Covers

This policy applies to:

* **POW account holders** — server owners, admins, and staff members who log into the dashboard.
* **In-game Roblox players** — players present in a PRC game server connected to POW. They don't have a POW account, but their in-game activity (logs, location, vehicle data) is processed through the platform on behalf of the server operator.

***

### 3. What We Collect and Why

#### 3.1 What You Give Us

| Data                               | Why we have it                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Roblox account** (ID, username)  | So we can link your in-game identity to your POW profile for moderation and shift tracking                                                             |
| **Discord account** (ID, username) | So the bot can assign roles and send notifications to the right person                                                                                 |
| **Email address**                  | For your POW account login and for analytics (see Section 3.3)                                                                                         |
| **Form responses**                 | Because your community asked you to fill out a form — we store the answers on their behalf                                                             |
| **File uploads**                   | Supporting documents attached to form submissions, stored on our servers                                                                               |
| **Leave of Absence reason**        | The reason you type when requesting time off from duty — this might include personal details; we store it because your server admin needs to review it |
| **Server configuration**           | Webhook URLs, Discord role IDs, automation rules, and the other settings admins configure                                                              |

#### 3.2 What We Collect Automatically from the Game

When a PRC server is connected to POW, we sync the following from the PRC API on behalf of the server operator:

| Data                              | Why we have it                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Join / leave events**           | Core moderation audit trail                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Kill logs**                     | Combat moderation and rule enforcement                                                                                                                                                                                                                                                                                                                                                                                           |
| **Command logs**                  | Accountability for in-game commands run by staff and players                                                                                                                                                                                                                                                                                                                                                                     |
| **Real-time player locations**    | X/Z coordinates, postal code, street name, and building — used for the live map and to give context when a mod call comes in                                                                                                                                                                                                                                                                                                     |
| **Vehicle data**                  | Vehicle name, licence plate, colour, livery, owner — displayed on the live map in the mod panel                                                                                                                                                                                                                                                                                                                                  |
| **Mod calls and emergency calls** | Caller name, description, location, and timestamp — displayed to on-duty staff                                                                                                                                                                                                                                                                                                                                                   |
| **Safety status lookups.**        | Where a community has the safety status feature enabled, we retrieve a safety status for the Roblox accounts of that community's members from Rotector, an independent third-party service. We retrieve and hold only a numeric status, the time we retrieved it, and the version of Rotector's system that produced it. We do not retrieve or hold any description, category, score, evidence, or reasoning behind that status. |
| **Panel access records.**         | When a member of your staff views a safety status, we record who viewed it, which account, and when. We keep this for 30 days. It exists so that misuse can be detected and so that we can answer a person who asks who has seen their status. It is never used to monitor or assess staff performance.                                                                                                                          |

This data is about **all players in the game**, including people who have never heard of POW. We process it because the server operator needs it for real-time moderation. We don't use it for anything else, and we don't sell it to anyone outside the platform.

#### 3.3 Analytics (PostHog)

We use PostHog to understand how people use the dashboard so we can improve it. Here's exactly what that means:

* **What PostHog receives:** Your email address, Roblox ID, Roblox username, Discord ID, Discord username, and errors that occured while you were using POW.
* **Why identity is linked:** We want to understand usage by account type and subscription plan — "what features are Pro subscribers actually using?" — not to build an advertising profile on you.
* **Where it lives:** PostHog data is hosted in the EU, on PostHog's infrastructure.
* **Cookies:** PostHog runs in memory-only mode until you accept cookies. If you decline, it still tracks your current session (in-memory, gone when you close the tab) but doesn't write any persistent cookies or localStorage entries. You can change this at any time via "Cookie Preferences" in the dashboard footer.
* **What PostHog does NOT get:** Your PRC API key, your custom bot token, your punishment records, or any form response content. Sensitive fields are masked at the SDK level.
* **We do not sell this data.** PostHog is a product analytics tool. Your data is not shared with advertisers, data brokers, or anyone else.

#### 3.4 Security Data

Every request to POW is checked for IP bans and rate limiting. We log IP addresses in our security log for security events (rate limit hits, blocked requests, suspicious activity). IP addresses are treated as personal data and are not shared outside the platform.

***

### 4. Data About In-Game Players

If you're a Roblox player who has never used POW but plays on a server that does, here's what you should know:

The server operator (the community owner) is the data controller for their server. POW processes in-game data on their behalf as a data processor. This is similar to any other moderation or logging tool a game server might use.

**What we store about you:** username, Roblox ID, join/leave events, kill logs, commands you ran, your in-game location at the time of logging, and your vehicle at the time of logging.

**What we do with it:** We display it to the staff team of that server so they can moderate their community, and use it to get any flags you may have from Rotector.

**What we don't do with it:** We don't sell it. We don't run ads against it. We don't use it to train AI models. It is scoped entirely to the server that collected it and deleted when that server's retention window expires.

**If you want it deleted:** Contact the server owner directly — they are the controller for their server's data. You can also email us at gdpr@atriasafety.org and we'll point you to the right place.

***

### 5. POW Vision

POW Vision is a desktop app that lets moderators identify players by pointing their crosshair at them. When you trigger the identification feature:

1. Vision captures a screenshot of your screen on **your local device**.
2. That screenshot is sent as a base64-encoded image to **Mistral AI's API** (Pixtral model) for OCR — to extract the Roblox username from the image.
3. Mistral returns the username string. The screenshot is not retained by Mistral after processing.
4. The screenshot is **never sent to or stored on POW's servers**.

In plain terms: your screenshot leaves your computer once, goes to Mistral to be read, and is then discarded. We never see it.

***

### 6. Third-Party Services

Here is every external service we send data to, and exactly what they receive:

| Service         | What they receive                                                                     | Why                                                                 |
| --------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Clerk**       | Your email, Roblox OAuth data, Discord OAuth data                                     | Handles login and sessions                                          |
| **PostHog**     | Email, Roblox ID/username, Discord ID/username, pageviews, clicks, session recordings | Analytics and UX improvement. EU-hosted.                            |
| **Mistral AI**  | Player data summaries (AI Insights); base64 screenshots (Vision)                      | AI moderation risk assessment; in-game OCR identification           |
| **PRC API**     | Your server's API key; outbound game commands                                         | Syncing game logs; executing automation commands                    |
| **Discord API** | Bot token, channel/role IDs, message content                                          | Bot notifications and role management                               |
| **Rotector**    | Roblox User IDs of your players.                                                      | To retrieve safety statuses of players of your ERLC private server. |

**File uploads are stored on POW's own servers** — not on any third-party storage service. Nobody outside POW has access to them except the server admin who owns the form.

**We do not work with:** advertising networks, data brokers, social media trackers, surveillance companies, or any intelligence services. Your data does not leave the above list.

***

### 7. Legal Basis (GDPR / UK GDPR)

| What we do                                                | Legal basis                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Running your account, shifts, and core dashboard features | Contractual necessity (Art. 6(1)(b))                                              |
| Game logs, moderation records, punishment history         | Legitimate interest of the server operator (Art. 6(1)(f))                         |
| Real-time location and vehicle tracking                   | Legitimate interest of the server operator for live moderation (Art. 6(1)(f))     |
| IP logging and security enforcement                       | Legitimate interest in platform security (Art. 6(1)(f))                           |
| Session recording and persistent analytics (PostHog)      | Consent — you can accept or decline via the cookie banner (Art. 6(1)(a))          |
| AI insights (Mistral)                                     | Legitimate interest of the server admin for player risk assessment (Art. 6(1)(f)) |
| Vision screenshot transmission                            | Legitimate interest of the moderator using Vision (Art. 6(1)(f))                  |

***

### 8. How Long We Keep It

| Data                                                         | How long                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Game logs, player locations, vehicle logs, shifts, mod calls | Per server's retention setting — 30 days (Free), 180 days (Pro), up to 3 years (Max) |
| Punishment records                                           | Minimum 2 years on all plans — moderation records need to stick around               |
| IP addresses in security log                                 | Up to 1 year from the event date, then purged                                        |
| Banned IPs                                                   | Until a POW admin removes the ban                                                    |
| Form responses and uploaded files                            | Until the form is deleted by the server admin                                        |
| Leave of Absence records                                     | While the server exists on POW                                                       |
| PostHog analytics                                            | 90–180 days, per PostHog's retention policy                                          |
| AI usage counters                                            | Rolling daily records only                                                           |
| Panel access records.                                        | We keep this for 30 days.                                                            |

When you or your server leaves POW, active account data is deleted. Punishment records may be retained for the minimum period above for audit purposes.

***

### 9. Your Rights

Depending on where you live, you may have the right to:

* **See your data** — request a copy of what we hold about you
* **Correct your data** — fix anything inaccurate
* **Delete your data** — request erasure (some moderation records may need to be kept for server safety)
* **Restrict processing** — ask us to pause processing while something is being disputed
* **Data portability** — get your data in a machine-readable format
* **Object** — push back on processing done under legitimate interest
* **Withdraw consent** — turn off persistent analytics any time via "Cookie Preferences" in the footer

Email `cian@atriasafety.org` and we'll respond within 30 days.

***

### 10. Security

* PRC API keys and custom bot tokens are encrypted at rest (AES).
* Only authorised POW developers and your server's admins can access your server's data.
* We don't log your API keys or bot tokens in plaintext anywhere.
* If we become aware of a breach affecting your data, we'll notify you within 72 hours as required by GDPR.

***

### 11. Contact

**Data Protection Officer:** Cian Kelly **Privacy / data requests:** `cian@atriasafety.org` **Legal inquiries:** `legal@atriasafety.org`

***

### 12. Changes

If we make significant changes to this policy, we'll announce it in the dashboard and in the official Project Overwatch Discord server. The "Last Updated" date at the top will always reflect the current version.
