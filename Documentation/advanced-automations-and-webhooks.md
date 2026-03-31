# Advanced Automations & Webhooks

Project Overwatch's Automation Engine is extremely powerful. For power users, you can use dynamic variables and HTTP Webhooks to connect your game server to external tools, databases, or custom dashboards.

## 1. Using Dynamic Variables

Variables allow your automation to include specific details from the event that triggered it. You can use these in **Discord Message content**, **PRC Command strings**, or **Webhook payloads**.

### Common Variables
| Variable | Description |
| :--- | :--- |
| `{player_name}` | The Roblox username of the player involved. |
| `{player_id}` | The Roblox ID of the player involved. |
| `{player_team}` | The in-game team of the player (if available). |
| `{server_name}` | Your custom server name. |
| `{join_key}` | The active Join Key for your server. |
| `{player_count}` | Current number of players online. |
| `{timestamp}` | Current ISO timestamp of the event. |
| `{punishment_reason}` | The reason provided for a punishment. |

### Example: Custom Join Message
*   **Trigger:** `PLAYER_JOIN`
*   **Action:** `Discord Message`
*   **Content:** `👋 Welcome {player_name} ({player_id}) to our server! There are now {player_count} players online.`

## 2. Conditional Logic (IF this happens)

Automations don't have to trigger every time. You can use multiple conditions to create complex rules.

*   **Operators:** `EQUALS`, `NOT_EQUALS`, `GREATER_THAN`, `LESS_THAN`, `CONTAINS`.
*   **Multiple Conditions:** All conditions must be true for the automation to run.
*   **Field Mapping:** You can check fields like `player.name`, `server.playerCount`, `details.command`, and more.

### Example: High-Value Target (HVT) Notification
*   **Trigger:** `PLAYER_JOIN`
*   **Condition:** `player.name` `CONTAINS` `Admin` (or a specific username)
*   **Action:** `Discord Message`
*   **Target:** `ADMIN_CHANNEL_ID`

## 3. Server-Wide Webhook Notifications

Unlike Automations (which are custom and conditional), **Webhook Notifications** are a global setting that triggers rich Discord embeds for specific server events. These are configured directly in your **Admin Panel → General Settings**.

### Supported Events
*   **Punishments:** Notifies on every Warning, Kick, Ban, or BOLO created.
*   **Shift Starts/Ends:** Perfect for a public `#on-duty-logs` channel.
*   **BOLO Alerts:** Instant notification when a "Be On the Look Out" record is created.
*   **LOA Requests:** Alerts staff management when a new Leave of Absence is submitted.

To set this up, simply paste a **Discord Webhook URL** into the settings and check the boxes for the events you want to track.

## 4. HTTP Webhooks in Automations (Advanced)

The `HTTP_REQUEST` action in the Automation Engine allows you to send raw data to any external URL using a **POST** request. Use this if you need to connect to a custom database or non-Discord service.

*   **URL:** The destination (e.g., `https://my-custom-app.com/api/webhooks/pow`).
*   **Body:** You can use JSON format and include variables.
*   **Use Cases:** Syncing player data to your own website, triggering physical alerts (IoT), or logging data to a Google Sheet.

### Example JSON Payload:
```json
{
  "event": "Player Joined",
  "username": "{player_name}",
  "roblox_id": "{player_id}",
  "server": "{server_name}",
  "time": "{timestamp}"
}
```

## 5. Time-Interval Automations

Instead of waiting for a player action, you can set an automation to run at regular intervals (e.g., every 30 minutes).

### Example: Auto-Announcement
*   **Trigger:** `TIME_INTERVAL`
*   **Conditions:** `intervalMinutes` : `30`
*   **Action:** `ANNOUNCEMENT`
*   **Content:** `Don't forget to join our Discord for community events! Join Key: {join_key}`

## 6. Automation Sequencing (Delays)

You can chain multiple actions together and use the **Delay** action to space them out.

### Example: Staggered Alert
1. **Action:** `Discord Message` (Initial alert)
2. **Action:** `Delay` (Wait 5 seconds)
3. **Action:** `KICK_PLAYER` (Execute the kick)

{% hint style="danger" %}
**Rate Limiting:** If an automation triggers too frequently (e.g., more than 10 times per second), POW will automatically disable it to protect your server's performance. Avoid triggers that fire on every chat message or movement unless you use very specific conditions.
{% endhint %}
