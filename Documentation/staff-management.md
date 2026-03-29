# Staff Management

Managing a large staff team is effortless with Project Overwatch. POW automatically tracks how much time your staff spend moderating and handles time-off requests.

## 1. Shift Management

To track their activity, staff must "clock in" using the Shift system.

### Starting a Shift
1. Log into the POW Dashboard and open the **Mod Panel** for your server.
2. In the top right (or the sidebar on mobile), click the green **Start Shift** button.
3. Your time on duty is now being recorded!

**What happens when a shift starts?**
* If an **On-Duty Role ID** is configured in Server Settings, POW will automatically assign that Discord role to the staff member.
* The system will start tracking seconds on duty towards their weekly quota.

{% hint style="info" %}
**In-Game Commands:** Staff can execute actions directly inside the game server!
* **Shift:** `:log shift start`, `:log shift end`, `:log shift status`
* **Punishments:** `:log warn [username] [reason]`, `:log kick [username] [reason]`, `:log ban [username] [reason]`, `:log bolo [username] [reason]`
* **Admin:** `:shutdown` (ends all active shifts and records the event)
{% endhint %}

### Ending a Shift
* Click the red **End Shift** button on the Mod Panel.
* POW will remove the On-Duty Discord role and log the final duration of the shift.

{% hint style="warning" %}
**Forgetting to End a Shift?** If a staff member leaves the Mod Panel open indefinitely, their shift will continue running. However, if a Server Admin uses the `:shutdown` command in-game, POW will automatically end all active shifts for everyone.
{% endhint %}

## 2. Quotas

Admins can set minimum time requirements (Quotas) for different staff ranks. 

### Setting Quotas
1. Go to the **Admin Panel** > **Roles**.
2. Edit or create a Panel Role.
3. Set the **Weekly Quota (Minutes)**. (e.g., setting it to `120` means that role requires 2 hours of shift time per week).

### Viewing Quota Progress
* **Staff view:** Their current progress is shown directly on the Mod Panel sidebar.
* **Admin view:** Go to the **Admin Panel** > **Quota**. Here you can see a breakdown of every staff member, how many hours they've completed, and whether they've met their requirement for the week.

{% hint style="info" %}
**Weekly Reset:** Quotas automatically reset at the start of every week (Sunday night / Monday morning depending on timezone).
{% endhint %}

## 3. Leave of Absence (LOA)

When a staff member cannot meet their quota due to real-life obligations, they can request a Leave of Absence.

### Requesting an LOA
1. On the Mod Panel, click the **Request LOA** button in the sidebar.
2. Select a **Start Date** and an **End Date**.
3. Provide a brief **Reason** for the absence.
4. Click Submit. 

### Admin Approval Workflow
1. When a request is submitted, it is sent to the **LOA Requests Channel** in Discord (if configured in settings).
2. Server Admins can review requests by navigating to the **Admin Panel** > **LOA**.
3. Click **Approve** or **Decline**.

**When an LOA is Approved:**
* The staff member is exempted from quotas for the duration of the LOA.
* If an **On-LOA Role ID** is configured in Server Settings, the bot will automatically assign this role to them in Discord for the duration of their absence, and remove it when the LOA expires.
