# Moderation Panel

The Moderation Panel is the core of Project Overwatch. It is designed to give your staff team real-time visibility into the game server and the tools they need to moderate effectively.

## Accessing the Panel

When you log into POW, your dashboard will list all the servers you have access to. Click **Mod Panel** on the server you wish to moderate.

{% hint style="warning" %}
**Permission Denied?** If you cannot see the Mod Panel, you may have been suspended (assigned the Suspended Discord Role) or you do not have the required Staff Discord Role. Contact your server owner.
{% endhint %}

## 1. Live Logs

The **Logs** tab provides a real-time feed of events happening in your PRC server. POW automatically syncs this data in the background.

* **Join/Leave Logs:** Track when players enter and leave the server.
* **Kill Logs:** Monitor combat. Logs will show the Killer and the Victim.
* **Command Logs:** See every command executed in-game by players or staff.

**Filtering Logs:**
Use the search bar at the top of the logs section to filter by a player's username or Roblox ID. This is extremely useful for tracking down the history of a specific troublemaker.

## 2. Managing Punishments

Project Overwatch provides several ways to log and manage disciplinary actions.

### How to Issue a Punishment
There are three primary ways to issue a punishment:
1.  **Opening a Player Panel:** Type a player's username into the search bar at the top of the player list, or click their name anywhere in the dashboard (Player List, Logs, etc.) to open their profile. From there, you can issue a Warning, Kick, Ban, or BOLO.
2.  **In-Game Commands:** Use the built-in command system without ever leaving Roblox (see section 4).
3.  **Quick Actions:** Click on a player's name directly from the **Command Logs** or **Join Logs** to instantly open their panel.

### Viewing Player History
Clicking on any player's name will open their **Player Profile**. This provides a complete history of:
* Every punishment they have ever received on your server.
* Their recent log activity (Joins, Kills, Commands).
* **AI Risk Assessment:** (Requires POW Pro/Max) A generated summary analyzing their behavior to determine if they are a high-risk player.

For more details, see our guide on [**Player Profiles & Panels**](player-panel.md).

## 3. The Toolbox

The **Toolbox** is a utility bar found in the Mod Panel that allows staff to quickly perform common actions and send commands to the game server.

### Available Tools
*   **Perm Log:** Quickly log when you grant a player permission for something in-game (e.g., "Roadwork", "Events"). This is saved and sent to the Discord Permission Log channel.
*   **Request LOA / On LOA:** Opens a modal to request a Leave of Absence directly from the panel. If you are already on an approved LOA, it displays an "On LOA" status instead.
*   **Run Command:** Opens a terminal window where you can type raw PRC commands (e.g., `:m Hello Server` or `:kick username reason`) and execute them immediately.
*   **Staff Request:** Sends an urgent alert. Online staff will be PM'd in-game, and a full alert with your reason will be sent to the Discord Staff Request channel.

{% hint style="warning" %}
**Toolbox Restrictions:** The Toolbox requires the `canUseToolbox` permission. Additionally, any raw commands executed via "Run Command" are logged in the **Command Log Channel** in your Discord for accountability.
{% endhint %}

## 4. In-Game Integration

POW supports in-game commands that automatically sync with the dashboard!

If a staff member is in the game, they can type:
*   **Punishments:** `:log warn [user] [reason]`, `:log kick [user] [reason]`, `:log ban [user] [reason]`, or `:log bolo [user] [reason]`.
*   **Shifts:** `:log shift start`, `:log shift end`, or `:log shift status`.

These commands will immediately create a record in the POW dashboard and trigger any related automations or Discord notifications. For punishments, POW will automatically look up the player's Roblox ID based on the username provided.

## Troubleshooting

**Error: "Action failed. Check your permissions."**
* **Fix:** You do not have the required Panel Role to perform this action. Ask an Admin to check your permissions in the Admin Panel -> Roles section.

**The Toolbox says "Server Offline" or shows no players.**
* **Fix:** The PRC server might be empty, restarting, or the PRC API Key is invalid. Wait a few minutes. If it persists, an admin must check the API key.

**Logs aren't updating!**
* **Fix:** Logs sync every few seconds. If they completely stop, it may be due to PRC API rate limits. Ensure your server isn't sharing the API key with too many other heavy-usage bots.
