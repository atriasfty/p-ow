# Automations and Roles

Project Overwatch is designed to reduce the busywork of managing a server. Through Role Sync, Automations, and Milestones, you can put your server management on autopilot.

## 1. Discord Role Sync

POW can automatically sync your Discord roles with the permissions granted on the Mod Panel.

### How it works:
1. When a user links their Discord account to POW, the system checks their roles in your Discord server.
2. If they have the **Staff Role ID** (configured in Server Settings), they automatically gain viewer access to the Mod Panel.
3. If they have a specific **Discord Role ID** mapped to a custom **Panel Role** (configured in Admin Panel > Roles), they will receive those specific permissions (e.g., Ban, Kick, Use Toolbox).
4. **Auto Sync Toggle:** If enabled in Server Settings, POW checks every 10 seconds to ensure the Mod Panel permissions perfectly match the user's current Discord roles. If you remove a Discord role, they lose Mod Panel access almost instantly!

{% hint style="warning" %}
**Important Roles:**
* **Suspended Role ID:** If a user gets this Discord role, they are completely blocked from the Mod Panel, regardless of their other roles.
* **Terminated Role ID:** If a user gets this Discord role, they are permanently removed from the server's member list on POW.
{% endhint %}

## 2. Automations Engine

Automations allow you to trigger actions in your Discord server based on events happening in the game.

### Creating an Automation
1. Go to **Admin Panel** > **Automations**.
2. Click **Create Automation**.
3. **Select a Trigger (WHEN this happens):**
   * **Events:** Player Join, Player Leave, Player Kill, Player Death, Command Used, BOLO Created, BOLO Cleared, Server Startup, Discord Message Received.
   * **Staff Actions:** Shift Start, Shift End, Any Punishment Issued, Warn Issued, Kick Issued, Ban Issued, Member Role Updated.
   * **Time-based:** Every X Minutes (Time Interval).
4. **Add Conditions (IF this is true):**
   * Example: `player.name` `EQUALS` `BadGuy123`
   * Example: `server.playerCount` `GREATER_THAN` `10`
5. **Select an Action (THEN do this):**
   * **Discord:** Discord Message, Discord DM
   * **Logging:** Log Entry, Shift Log
   * **Game Actions:** Custom Command (PRC Command), Kick Player, Ban Player, Kill Player, Server Announcement, Teleport Player
   * **Database/Web:** Warn Player (DB), Webhook / HTTP Request
   * **Utility:** Delay / Wait

### Example Use Cases
* **High-Value Target Alert:** Trigger on `Player Join`, condition `player.name` EQUALS `Target123`, Action: `Discord Message` to ping staff.
* **Abuse Prevention:** Trigger on `Command Used`, condition `command` CONTAINS `:shutdown`, Action: `Discord Message` to alert the owner.
* **Timed Announcements:** Trigger on `Every X Minutes`, Action: `Server Announcement` to remind players of server rules.

## 3. Staff Milestones

Reward your most dedicated staff members automatically based on their activity **each week**.

### Creating a Milestone
1. Go to **Admin Panel** > **Milestones**.
2. Click **Create Milestone**.
3. **Name:** e.g., "Silver Moderator".
4. **Required Minutes:** The amount of duty minutes required **within a single week** (e.g., `300` for 5 hours per week).
5. **Reward Role ID:** Select the Discord Role that should be granted.

### Weekly Evaluation
POW evaluates milestones every time a staff member finishes a shift.
* **Weekly Calculation:** Only shift time from the current Monday to Sunday is counted towards milestones.
* **Automatic Rewards:** When a staff member hits the required weekly time, POW will automatically assign them the Reward Role in Discord!
* **Announcements:** If you have a **Milestone Announcement Channel** configured in Server Settings, it will publicly announce their achievement!

{% hint style="info" %}
**Roles are Persistent:** Once a staff member earns a milestone role, the bot will not remove it, even if a new week starts. This allows you to track long-term dedication through weekly achievements.
{% endhint %}

## Troubleshooting

**A user's roles aren't syncing!**
* **Fix:** Check that **Auto Sync Roles** is enabled in Server Settings. Ensure the user has actually linked their Discord account to POW. Finally, ensure your Discord Guild ID is correct and the POW bot is online.

**My automation isn't triggering!**
* **Fix:** Double-check your conditions. Conditions are case-sensitive by default. Ensure the channel you selected for the "Send Message" action still exists and the POW bot has permission to post in it.

**Staff hit their milestone but didn't get the role.**
* **Fix:** The POW bot MUST have a role that is positioned higher than the "Reward Role" in your Discord server settings, otherwise Discord blocks the bot from assigning it.
