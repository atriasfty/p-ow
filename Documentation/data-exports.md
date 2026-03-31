# Data Exports

For larger communities, you may need to keep external backups of your staff's performance or import data into Google Sheets/Excel for custom analysis. POW allows server owners to export critical data as CSV files.

{% hint style="info" %}
**Requirements:** Data Exports require an active **POW Pro** or **POW Max** subscription.
{% endhint %}

## Exporting Data

1. Navigate to your Server's **Admin Panel**.
2. Click on the **Superadmin** or **Danger Zone/Export** tab (depending on your access level and layout).
3. Look for the **Data Exports** section.

You can currently export the following datasets:

### 1. Members Export
Downloads a CSV list of all users registered to your POW server.
* **Included Data:** Roblox Username, Discord Username, their assigned POW Panel Role, and whether they have Admin access.

### 2. Shifts Export
Downloads a CSV of the last 500 shift records.
* **Included Data:** Roblox Username, Shift Start Time, Shift End Time, and Total Duration (in seconds).
* *Tip:* You can use Excel formulas to convert the duration from seconds into hours and minutes.

### 3. Roles Export
Downloads a CSV of all Panel Roles configured for your server.
* **Included Data:** Role name, mapped Discord Role ID, the number of members with the role, and key permissions (like `canBan`, `canUseToolbox`).

### 4. Punishment Logs Export
Downloads a CSV of the last 1,000 recorded punishments.
* **Included Data:** Roblox Username of the user, Roblox Username of the moderator, Type (Warn/Kick/Ban/BOLO), Reason, Resolution Status, and Created Timestamp.

## Using the Exported Data

The downloaded files will be in `.csv` (Comma Separated Values) format. 

* **To view them:** Simply double-click the file to open it in Microsoft Excel, Apple Numbers, or any text editor.
* **To analyze them:** Open Google Sheets, click `File > Import`, and upload the `.csv` file. Google Sheets will automatically format it into a readable table.
