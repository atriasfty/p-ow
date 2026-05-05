# Raid Mitigation

**Raid Mitigation** is an admin tool that helps you recover from a raid where a malicious or compromised user executed unauthorized commands in your Roblox server. It lets you look up what commands a player ran and roll back their actions in bulk.

{% hint style="info" %}
**Location:** Admin Panel → Raid Mitigation.
{% endhint %}

{% hint style="warning" %}
**This tool is for recovery, not detection.** For live raid *detection* (alerts when suspicious activity is occurring), see [Raid Detection](raid-detection.md). Use Raid Mitigation after the fact to undo the damage.
{% endhint %}

## How It Works

When a raider — or a compromised staff account — executes commands like `:ban`, `:unadmin`, or `:kick` against a list of players, POW can identify those actions in its command logs and calculate what needs to be reversed.

### Step 1: Look Up the Raider

Enter the Roblox username of the player whose actions you want to review. POW will:
1. Resolve the username to a Roblox User ID.
2. Pull the last 100 command log entries where that player was the actor.
3. Scan for reversible commands (`:ban`, `:unban`, `:unadmin`, `:unmod`).

### Step 2: Review the Detected Actions

POW shows how many potentially reversible actions were found in the player's recent history. You can review the raw log to confirm what was done and when.

### Step 3: Roll Back

Set a **rollback timestamp** — POW will reverse all eligible actions the player performed after that point.

{% hint style="danger" %}
**Rollbacks are irreversible.** Once you confirm a rollback, the commands are executed against your live PRC server immediately. Double-check the timestamp and the player you are targeting before confirming.
{% endhint %}

## Reversible Commands

Currently, POW can automatically reverse the following in-game actions:

| Original Command | Rollback Action |
|---|---|
| `:ban [player]` | `:unban [player]` |
| `:unadmin [player]` | `:admin [player]` |
| `:unmod [player]` | `:mod [player]` |
| `:unban [player]` | `:ban [player]` |

{% hint style="info" %}
**Kicks are not reversible.** A `:kick` removes a player from the session but doesn't prevent re-joining, so there is nothing to roll back. Players can simply rejoin the server.
{% endhint %}

## Limitations

* **Logs must exist in POW.** Raid Mitigation can only reverse actions that were captured in POW's command logs. If the raider acted before POW was connected, or during a period when logs weren't syncing, those actions won't appear.
* **Only works while the server is online.** Rollback commands are sent to the live PRC server via the bot. If your game server is offline or restarting, wait for it to come back before running a rollback.
* **Cross-check with Raid Detection.** After a raid, review the [Raid Detection](raid-detection.md) alert in Discord to get the full list of involved usernames before using this tool.

## After a Raid — Recommended Steps

1. **Remove the compromised account** from your staff list (Admin Panel → Members) or revoke their Discord role immediately.
2. **Use Raid Mitigation** to roll back unauthorized bans or permission changes.
3. **Review the Audit Log** (Admin Panel → Audit Log) to check whether any server settings were changed during the incident.
4. **Rotate your PRC API Key** (Admin Panel → Settings → Danger Zone) if you suspect the attacker had access to it.
5. **Post an announcement** in-game or on Discord to reassure affected players.
