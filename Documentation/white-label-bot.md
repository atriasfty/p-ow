# White Label Bot

For communities that want a fully branded experience, POW Max subscribers can enable the **White Label Bot** feature. This allows you to replace the default "Project Overwatch" Discord bot with your very own custom bot.

All notifications, role syncs, and embeds will be sent under your bot's name and avatar.

## 1. Upgrading to POW Max

To use this feature, your server must be on the **POW Max** subscription plan. 
1. Navigate to the **Admin Panel** > **Subscription**.
2. Upgrade your server's plan if necessary.

## 2. Creating Your Discord Bot

Before configuring POW, you need to create the bot on Discord.

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and give it a name (this will be your bot's name).
3. Set a Profile Picture/Avatar for your application.
4. Click on the **Bot** tab on the left sidebar.
5. Click **Reset Token** and copy the new **Bot Token**. Keep this secret!
6. **CRITICAL:** Scroll down to the **Privileged Gateway Intents** section and enable **Server Members Intent** and **Message Content Intent**. Save your changes.

## 3. Inviting Your Bot

1. In the Developer Portal, go to **OAuth2** > **URL Generator**.
2. Under "Scopes", select **bot**.
3. Under "Bot Permissions", select:
   * Manage Roles
   * View Channels
   * Send Messages
   * Embed Links
4. Copy the Generated URL at the bottom of the page and paste it into your browser to invite the bot to your Discord server.
5. **IMPORTANT:** Once invited, go to your Discord server settings > Roles, and drag your new bot's role as high up the list as possible (it must be above any roles you want it to assign, like Staff or On-Duty roles).

## 4. Configuring POW

1. Go to your POW **Admin Panel** > **Settings**.
2. Scroll down to the **White Label Bot** section.
3. Toggle **Enable Custom Bot** to ON.
4. Paste the **Bot Token** you copied earlier into the input field.
5. Click **Save Changes**.

POW will immediately switch all operations (Role Syncing, Notifications, Form Alerts) to use your custom bot instead of the default one!

## Troubleshooting

**Error: "Bot token not configured" or "Failed to sync roles"**
* **Fix:** Ensure the token you pasted is correct and hasn't been reset. Ensure you enabled the "Server Members Intent" in the Discord Developer Portal.

**The bot is in the server but isn't giving roles!**
* **Fix:** The bot's role in Discord is too low. A bot cannot assign a role that is higher than its own role in the hierarchy. Go to Server Settings > Roles and drag your bot's role up.

**I disabled my custom bot, now nothing works.**
* **Fix:** If you disable your custom bot, POW reverts to using the default Project Overwatch bot. Make sure the default bot is still invited to your server and has the necessary permissions.
