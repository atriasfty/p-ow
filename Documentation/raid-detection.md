# Raid Detection

Project Overwatch includes an automated Raid Detection system to protect your server from coordinated attacks or mass rule-breaking events. 

{% hint style="info" %}
**Requirements:** Raid Detection requires an active **POW Pro** or **POW Max** subscription.
{% endhint %}

## How it Works

The system constantly monitors the `Command Logs` and `Join Logs` streaming from your PRC server. 

It looks for suspicious patterns, such as:
* Multiple users running disruptive commands (like `:m`, `:h`, or `:kick`) in a short time frame.
* A sudden spike in new players joining simultaneously.
* Activity from known malicious groups.

**Crucially**, POW cross-references these actions against your registered staff list. If a staff member uses these commands, it's considered normal. If a non-staff member uses them, it triggers the detector.

## Configuring the Alert Channel

To use Raid Detection, you must set up an Alert Channel so POW can notify your team.

1. Go to your Server's **Admin Panel** > **Settings**.
2. Scroll to the **Discord Integration** section.
3. Find **Raid Alert Channel** and select a private staff channel from the dropdown.

When a raid is detected, POW will immediately send a high-priority embed to this channel, tagging your **Staff Role**. The alert will list the specific Roblox usernames and IDs of the suspected raiders, along with the commands they used.

## Responding to an Alert

When an alert triggers, your staff should:
1. Review the provided usernames.
2. Open the **Mod Panel** or **POW Vision**.
3. Use the **Toolbox (Run Command)** or **Quick Actions** to quickly kick or ban the offending players.

{% hint style="warning" %}
**False Positives:** The detector relies on identifying non-staff using commands. If a staff member is *not* registered on the POW dashboard (or hasn't linked their Discord/Roblox correctly), their actions may trigger a false raid alert. Ensure all staff are properly set up!
{% endhint %}
