# Getting Started

Welcome to Project Overwatch! This guide will walk you through setting up your first server on POW. 

### 1. Creating Your Account

Before managing a server, you'll need a POW account.

1. Go to **pow.ciankelly.xyz** and click **Sign In**.
2. We strongly recommend using **Discord** or **Roblox** to sign in, as both will be required eventually to unlock all features.
3. Once logged in, you'll land on your personal dashboard.

{% hint style="info" %}
**Note for Server Owners:** Make sure the Discord account you link is the one that has ownership or admin rights in your Discord server!
{% endhint %}

### 2. Linking Your PRC Server

POW uses a **Server Creation Wizard** to help you link your community in minutes.

1. In the POW Dashboard, click **Create Server**.
2. Follow the 3-step setup process:
   * **Verify PRC:** Enter your PRC API Key from ERLC.
   * **Verify Discord:** Select your Discord server and ensure the POW Bot is invited.
   * **Configure:** Choose your admin roles and log channels.

For a detailed step-by-step walkthrough, see our [**How to Create a Server**](how-to-create-a-server.md) guide.

{% hint style="warning" %}
**Permission Requirement:** You must have **Administrator** or **Manage Server** permissions in the Discord guild to link it to POW.
{% endhint %}

### 3. Configuring Discord Integration

POW works best when it can automatically sync roles and send notifications to your Discord server.

1. Go to your Server's **Admin Panel** > **Settings**.
2. Under **Discord Integration**, enter your **Discord Server ID (Guild ID)**.
3. **Invite the POW Discord Bot** to your server. 

{% hint style="danger" %}
**Role Hierarchy:** Make sure to give the bot a role that is positioned **higher** than any roles you want it to manage (like Staff or On-Duty roles). The bot needs `Manage Roles` permission to function.
{% endhint %}

### 4. Granting Staff Access

Your staff don't need to be manually invited! Access is handled automatically through Discord.

1. Have your staff members go to **pow.ciankelly.xyz** and link their **Discord** accounts.
2. If they have the **Staff Role** in your Discord server, POW's **Auto-Join** feature will automatically detect them.
3. The next time they refresh their dashboard, your server will appear!
