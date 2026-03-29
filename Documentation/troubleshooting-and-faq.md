# Troubleshooting & FAQ

If you are running into issues with Project Overwatch, this guide will help you solve the most common problems.

## Account & Linking Issues

**Q: I created an account, but my dashboard says "No servers found".**
* **A:** This means you have not been granted access to any servers yet. 
  1. Ensure you have linked your **Discord Account** to your POW profile in Account Settings.
  2. Ensure you are in the correct Discord server.
  3. Ensure the server owner has given you the correct **Staff Role** in Discord.
  4. Ensure the server owner has **Auto Sync Roles** enabled.

**Q: It says "You must link your Roblox account" when I try to submit a form.**
* **A:** Some forms require a Roblox account to verify your identity. Go to your Account Settings on **[pow.ciankelly.xyz](https://pow.ciankelly.xyz)** and click "Connect Roblox". Ensure you are logged into the same account you used to fill out the form.

## Discord Bot Issues

**Q: The POW bot isn't syncing roles or sending messages!**
* **A:** This is almost always a permissions issue in Discord.
  1. Go to your Discord Server Settings > Roles.
  2. Find the "Project Overwatch" role (or your custom bot's role).
  3. **Drag it up** so it is higher than any role it needs to assign (like Staff, On-Duty, or On-LOA).
  4. Ensure the bot has the `Manage Roles`, `View Channels`, and `Send Messages` permissions.

**Q: How do I kick/ban the bot and start over?**
* **A:** You can kick the bot from Discord and re-invite it using the invite link on the POW dashboard. Make sure you drag its role back up to the top!

## Game Server (PRC) Issues

**Q: The Mod Panel says "Server Offline" but people are playing!**
* **A:** This means POW cannot connect to your PRC server.
  1. Go to the Admin Panel > Settings > Danger Zone.
  2. Generate a new API key in the PRC Dashboard.
  3. Enter the new key into POW and click "Update Key".

**Q: Why aren't punishments working from the Toolbox?**
* **A:** Ensure the user you are targeting is currently in the game. Some commands (like Kick) require the player to be online. If it's a Ban, ensure you spell their Roblox username exactly correctly.

## Billing & Subscriptions

**Q: I upgraded to POW Pro/Max, but my server still says "Free Plan".**
* **A:** Subscriptions are tied to your *user account*. You must manually link your subscription to a server.
  1. Go to the POW Dashboard home page.
  2. You will see a banner that says "You have an unlinked subscription."
  3. Click "Link to Server" and select the server you want to upgrade.

**Q: How do I downgrade or cancel?**
* **A:** Go to your Account Settings or the Subscription tab in the Admin Panel and click "Manage Subscription" to open the billing portal.

## Forms & Applications

**Q: Users are seeing "You do not have permission to view this form".**
* **A:** Check the form's **Discord Role Gating** settings. You may have accidentally required a role that users don't have, or blacklisted a role that they do have. Also, ensure the Discord Guild ID is set correctly in your Server Settings so POW knows which Discord server to check.

**Q: I accepted an application, but the user didn't get their Discord role.**
* **A:** Check the Discord Bot Issues section above. The bot's role must be higher than the role it is trying to assign. Also, ensure the applicant actually linked their Discord account to POW.

> [!INFO] Still Need Help?
> If you've tried everything above and still need help, please reach out to our support team in the official Project Overwatch Discord server!