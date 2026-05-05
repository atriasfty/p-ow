# How to Add Custom Toolbox Buttons

The **Toolbox** in the Moderation Panel has a set of built-in tools for your staff team. Using the Automations system, you can also add your own **custom buttons** — each one can trigger any sequence of automation actions with a single click.

Common uses include:
* Sending a pre-written announcement to a Discord channel
* Running a PRC command (e.g. locking the server or teleporting a player)
* Posting to a webhook (e.g. pinging a backup staff team in a separate Discord server)
* Running a multi-step action sequence with delays

---

## Step 1: Create a New Automation

1. Go to **Admin Panel** → **Automations**.
2. Click **Create Automation**.
3. Give the automation a short, descriptive name — this name will appear as the **button label** in the Toolbox (e.g. `Lock Server`, `Call for Backup`, `Announce Rules`).

---

## Step 2: Select the "Toolbox Button" Trigger

In the **Trigger** dropdown, select:

> **Toolbox Button (Manual Trigger)**

This tells POW that this automation should appear as a clickable button in the Toolbox rather than firing automatically on an event.

{% hint style="info" %}
Unlike other triggers, Toolbox Button automations do **not** fire automatically. They only run when a staff member manually clicks the button in the Toolbox.
{% endhint %}

---

## Step 3: Configure the Button Appearance

After selecting the Toolbox Button trigger, two extra configuration options will appear:

### Button Color

Click the colour picker to choose a custom accent colour for your button. The button in the Toolbox will use a tinted version of this colour (background, border, and text), keeping it consistent with the rest of the Toolbox UI.

### Visible to Roles

By default, a Toolbox Button is visible to **all staff** who have the `canUseToolbox` permission. If you want to restrict a button to specific staff ranks, use this setting.

* Click the roles you want to allow. Selected roles are highlighted.
* Only staff whose Panel Role is in this list will see the button.
* Admins always see all buttons, regardless of role restrictions.
* Leave this empty to make the button visible to everyone with Toolbox access.

{% hint style="warning" %}
Role visibility is enforced **server-side**. A staff member who does not have the required role will not see the button and cannot execute the automation even if they manually call the API.
{% endhint %}

---

## Step 4: Add Your Actions

Scroll down to the **Actions** section. Add one or more actions that should run when the button is clicked. Examples:

| Action | What it does |
|---|---|
| **Discord Message** | Posts a message to a Discord channel |
| **Custom Command (PRC)** | Runs a command in your Roblox server (e.g. `:m Server lock is now ON`) |
| **Webhook / HTTP Request** | Sends a POST request to an external service |
| **Delay / Wait** | Pauses execution before the next action |
| **Server Announcement** | Sends an in-game announcement to all players |

You can chain multiple actions together. For example: send a Discord alert, wait 3 seconds, then run an in-game announcement.

{% hint style="info" %}
**Variables work here too.** You can use `{server_name}`, `{player_count}`, `{join_key}`, and other supported variables inside Discord messages and PRC command strings. See [Advanced Automations & Webhooks](advanced-automations-and-webhooks.md) for the full variable list.
{% endhint %}

---

## Step 5: Save and Enable

1. Click **Save**.
2. Make sure the **Enabled** toggle is turned on (it is on by default).

The button will appear immediately in the Toolbox for eligible staff.

---

## Using the Button

Once set up, eligible staff will see a new **Custom Actions** section at the bottom of the Toolbox.

1. Click your custom button.
2. POW runs all the configured actions in order.
3. The button briefly shows a loading spinner while the actions execute, then displays a success indicator.

{% hint style="info" %}
There is no confirmation prompt — the actions run immediately when the button is clicked. If you want a "are you sure?" step, build two separate automations: a first button that posts a Discord message with instructions, and a second button for the actual action.
{% endhint %}

---

## Managing Buttons

* **Disable:** Toggle **Enabled** off on the automation. The button disappears from the Toolbox immediately.
* **Delete:** Delete the automation from the Admin Panel → Automations list.
* **Edit:** Change the name, colour, role restrictions, or actions at any time. Changes take effect within seconds.
* **Reorder:** The buttons appear in the order they were created. To change the order, delete and recreate them in the desired sequence (or rename them with a prefix like `1 –`, `2 –`).

---

## Troubleshooting

**The button isn't showing up in my Toolbox.**
* Ensure the automation is **Enabled**.
* Ensure your Panel Role has the `canUseToolbox` permission.
* If the button has Role Restrictions, confirm your Panel Role is in the allowed list.
* Try refreshing the Mod Panel.

**The button shows a spinner but nothing happens.**
* Check that the action is configured correctly (e.g. the target Discord channel still exists and the POW bot has permission to post there).
* If using a **Custom Command (PRC)**, verify your PRC API key is valid and the game server is online.
* Check your server's automation logs in Admin Panel → Automations → (automation name) → Logs.

**I clicked the button but only some of the actions ran.**
* A failed action stops the sequence. For example, if a **Delay** precedes a **Discord Message** and the channel no longer exists, the message action fails.
* Review each action's configuration. Check the automation logs for the specific error.
