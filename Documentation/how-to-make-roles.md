# How to Make Roles

Roles in Project Overwatch (POW) allow you to grant specific permissions (like Banning or using the Toolbox) to your staff based on their rank in Discord.

### 1. The Permissions Hierarchy
POW uses a tiered permission system:
- **Default (Viewer):** Anyone with the Discord "Staff Role" gets basic access to view logs, starts shifts, and use the Toolbox.
- **Admin Flag:** Anyone marked as an "Admin" in the member list (including the Server Owner) has full access to everything.
- **Custom Panel Roles:** These map specific Discord Role IDs to specific dashboard permissions.

### 2. Creating a Custom Role
1. Go to your server's **Admin Panel > Roles**.
2. Click **Add New Role**.
3. **Role Name:** Give it a name (e.g., "Senior Moderator").
4. **Discord Role ID:** Paste the ID of the rank in your Discord server that should get these powers.
    - *How to get ID:* In Discord, right-click the role in your Server Settings > Roles and click **Copy Role ID**.
5. **Permissions:** Check the boxes for the powers you want to grant (Warn, Kick, Ban, Manage Bolos, etc.).
6. **Weekly Quota:** Set the number of minutes this rank is required to be on shift each week.

### 3. Activating the Sync
Once you save the role, POW will automatically detect any members who have that Discord rank.
- **Auto-Sync:** If **Auto Sync Roles** is enabled in your **Admin Settings**, POW will update user permissions within 10 seconds of them receiving or losing a rank in Discord.

> [!IMPORTANT] Bot Position
> The **Project Overwatch Bot** must be positioned **HIGHER** in your Discord role hierarchy than any role you are trying to sync or manage. If the bot's role is too low, Discord will block it from reading/assigning those ranks.
