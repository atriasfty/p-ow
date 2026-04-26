# Behavior Settings

The **Behavior Settings** page lets server admins fine-tune how POW operates for their specific community — changing shift rules, quota periods, in-game command prefixes, raid detection thresholds, data retention windows, and more. All settings are per-server and take effect within 60 seconds of saving.

{% hint style="info" %}
**Location:** Admin Panel → Behavior. Settings are grouped into collapsible cards. Each card has its own **Save** button — only that card's fields are updated when you click it.
{% endhint %}

---

## Shift & Duty

Controls when staff can go on duty and how the system behaves during shifts.

| Setting | Default | Description |
|---|---|---|
| Shift PM Branding | `[POW]` | Prefix shown in all in-game PMs sent by POW |
| Status Format | Percent | Format for `:log shift status` — Percent of quota, Clock time, or Remaining time |
| Min Shift Duration | 0 (off) | Minimum shift length in seconds. Informational only — does not block ending early. |
| Max Shift Duration | 0 (off) | Auto-ends shifts longer than this many hours |
| Shift Cooldown | 0 (off) | Minutes a staff member must wait between shifts |
| Max Staff On Duty | 0 (unlimited) | Blocks additional shifts when this many staff are already on duty |
| End shifts on :shutdown | On | Automatically ends all active shifts when a shutdown command is detected |
| Require players in-game | On | Prevents a shift from starting if there are no players in the Roblox server |
| LOA blocks shift start | Off | Staff with an active approved LOA cannot start a shift |

---

## Quota

Controls how duty time is measured and which period counts.

| Setting | Default | Description |
|---|---|---|
| Period Type | Weekly | Whether quotas reset weekly or monthly |
| Week Start Day | Monday | Which day a new quota week begins |
| Timezone | UTC | IANA timezone used for week/month boundary calculation |
| Grace Period | 0 (off) | Extra minutes after the period ends where time still counts |
| Min Shift Duration to Count | 0 (all) | Shifts shorter than this many seconds don't count toward quota |

{% hint style="info" %}
**Example:** An LSPD community in the US Eastern timezone can set Timezone to `US Eastern` and Week Start Day to `Monday` so their quota week aligns with their real-world schedule.
{% endhint %}

---

## In-Game Commands

Controls the prefix staff type in-game and which actions are allowed.

| Setting | Default | Description |
|---|---|---|
| Command Prefix | `:log` | The prefix staff use for all in-game commands |
| Target Lookback | 30 min | How far back to search for players who recently left the server |
| Shutdown Patterns | `:shutdown` | Commands that trigger the shutdown handler (end all shifts, record event) |
| :log shift | On | Allow shift start/end/status from in-game |
| :log warn | On | Allow in-game warn logging |
| :log kick | On | Allow in-game kick logging |
| :log ban | On | Allow in-game ban logging |
| :log bolo | On | Allow in-game bolo logging |
| Roblox API fallback | On | If a player isn't in the current session, fall back to Roblox username lookup |

{% hint style="warning" %}
**Changing the prefix:** If you change the command prefix from `:log` to something else (e.g. `:mod`), staff must immediately start using the new prefix in-game. Old commands will stop working.
{% endhint %}

---

## Raid Detection

Configures what triggers a raid alert and how the alert embed looks in Discord.

| Setting | Default | Description |
|---|---|---|
| High-Freq Threshold | 5 | Number of sensitive commands within the window that triggers an alert |
| High-Freq Window | 10 seconds | Time window for the frequency check |
| Sensitive Commands | `:ban`, `:kick`, etc. | Commands that are counted toward raid detection |
| Mass Action Patterns | `all`, `others`, `random` | Substrings in a command argument that indicate a mass action |
| Alert Title | `⚠️ RAID DETECTION ALERT` | Title shown in the Discord embed |
| Alert Color | Red (`#FF0000`) | Color of the Discord embed |

{% hint style="info" %}
**Tuning sensitivity:** If you're getting false positives from legitimate mass moderations, raise the threshold. If raids are slipping through, lower it or reduce the window.
{% endhint %}

---

## Milestones

Controls how staff milestone achievements are tracked and announced.

| Setting | Default | Description |
|---|---|---|
| Period Type | Weekly | Whether milestones are measured over the week, month, or lifetime total |
| Notification Debounce | 24 hours | Minimum time between duplicate milestone notifications for the same member |
| Keep milestone roles permanently | On | Once earned, milestone roles are not removed even if the member drops below the threshold |
| Embed Title | `🏆 Weekly Milestone Reached` | Title of the Discord announcement embed |
| Embed Color | Emerald (`#10b981`) | Color of the Discord announcement embed |

---

## Leave of Absence

Sets validation rules and notification behavior for LOA requests.

| Setting | Default | Description |
|---|---|---|
| Max Duration | 0 (unlimited) | Maximum LOA length in days. Requests exceeding this are rejected at submission. |
| Min Notice | 0 (off) | How many days in advance the start date must be |
| Max Pending Per Member | 0 (unlimited) | How many pending LOA requests a single member can have at once |
| Embed Color | Indigo (`#6366f1`) | Color of LOA notification embeds in Discord |
| Fallback to staff request channel | On | If no LOA channel is configured, send notifications to the staff request channel |

{% hint style="info" %}
To prevent staff on LOA from starting shifts, enable **LOA blocks shift start** in the **Shift & Duty** section.
{% endhint %}

---

## Punishment

Controls available punishment types and what happens when a punishment is issued.

| Setting | Default | Description |
|---|---|---|
| Punishment Types | Warn, Kick, Ban, Ban Bolo | The list of types available in the Perm Log UI |
| Warn Auto-Resolve | 0 (never) | Automatically resolve warnings older than this many days |
| Enforce ban in-game | Off | When a Ban is logged in POW, also execute `:ban` in Roblox via the bot |
| Notify on punishment create | Off | Send a Discord notification to the perm log channel each time a punishment is issued |

---

## Forms

Controls defaults and restrictions for the Forms & Applications system.

| Setting | Default | Description |
|---|---|---|
| Allow multiple submissions by default | On | New forms default to allowing the same person to submit more than once |
| Min Roblox Account Age | 0 (off) | Reject form submissions from Roblox accounts younger than this many days |
| Notify on form expiry | Off | Send a notification when a form reaches its expiry date |

---

## Notifications & Branding

Appearance and behavior of outbound Discord and in-game notifications.

| Setting | Default | Description |
|---|---|---|
| Staff Request PM Branding | `Project Overwatch` | Shown at the end of in-game staff request PMs |
| Staff Request Embed Color | Orange (`#FFA500`) | Color of the Discord embed for staff requests |
| JIT Verify Interval | 5 minutes | How often POW re-checks a staff member's Discord roles to confirm access |
| SSD Display Window | 7 days | How long ago a server shutdown is still shown in the mod panel |
| DM on LOA approval | Off | Send a Discord DM to the staff member when their LOA is approved |
| Show all teams on player map | On | If off, only staff teams are visible on the live player map |
| Vehicle tracking | On | Save vehicle snapshot data from the PRC API for display in the mod panel |

---

## Automation

Settings for the Automation engine.

| Setting | Default | Description |
|---|---|---|
| Announcement Command Prefix | `:m` | PRC command prefix used when an Automation runs an ANNOUNCEMENT action |
| Default Time Interval | 60 minutes | Default interval for TIME_INTERVAL automations with no explicit value set |
| Mod Call Dedupe Window | 60 minutes | Window used to match incoming mod calls to existing DB records to avoid duplicates |

---

## Live Data Snapshots

Controls how much historical data is sent to the mod panel when a staff member first connects.

| Setting | Default | Description |
|---|---|---|
| Player Window | 2 minutes | How far back to look for player location data on initial load |
| Mod Call Snapshot Limit | 50 | Maximum number of mod calls included in the initial snapshot |
| Emergency Call Snapshot Limit | 50 | Maximum number of emergency calls included in the initial snapshot |

{% hint style="info" %}
Increasing snapshot limits will make the initial panel load slightly slower on servers with very high call volume.
{% endhint %}

---

## Data Retention

Controls how long historical records are kept before automatic deletion.

{% hint style="danger" %}
**Deleting data is permanent and cannot be undone.** Records older than your retention window are purged once per day automatically.
{% endhint %}

Retention limits are tied to your subscription plan:

| Plan | Default Retention | Maximum Retention |
|---|---|---|
| Free | 30 days | 30 days |
| POW Pro | 180 days | 180 days |
| POW Max | 1095 days (~3 years) | 1095 days (~3 years) |

You can set a **shorter** retention period than your plan default (for privacy), but you cannot exceed your plan's ceiling.

The following data is purged when records exceed the retention window:
- Game logs (joins, kills, commands)
- Shift records (completed shifts only — active shifts are never deleted)
- Punishments
- Mod calls and emergency calls
- Player location snapshots
- Vehicle logs
