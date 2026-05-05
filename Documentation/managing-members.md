# Managing Members

The **Members** page in the Admin Panel gives you a full view of every staff account registered to your server — and lets you manage their roles, permissions, and access directly from the dashboard.

{% hint style="info" %}
**Location:** Admin Panel → Members. Only Server Admins and the Server Owner can access this page.
{% endhint %}

## The Member List

The member list shows all users who have joined your POW server (via Discord Auto-Join or manual invite). For each member you can see:

* Their **Roblox Username** and **Discord Username**
* Their current **Panel Role** (the POW role that controls their permissions)
* Whether they have the **Admin flag** (full access to the Admin Panel)
* Their linked account IDs (Roblox ID, Discord ID, Clerk ID) — useful for support and debugging

A search bar lets you filter by name across all pages. The list paginates in groups of 50.

## Changing a Member's Role

1. Find the member in the list.
2. Click the **Role** dropdown next to their name.
3. Select the new Panel Role.

The change takes effect immediately — their permissions update the next time they load the Mod Panel.

{% hint style="info" %}
**Role definitions** (which permissions each role grants, weekly quota requirements, Discord Role mapping) are managed separately in Admin Panel → Roles. See [How to Make Roles](how-to-make-roles.md).
{% endhint %}

## Granting or Revoking Admin Access

The **Admin** toggle next to each member gives them full access to the Admin Panel, equivalent to a server co-owner.

{% hint style="danger" %}
**Admins can do everything you can.** This includes changing settings, viewing the Audit Log, managing API keys, and removing other members. Only grant admin access to people you fully trust.
{% endhint %}

## Viewing a Member's Shift Heatmap

Click the **chart icon** next to a member's name to open their **Shift Heatmap**. This shows a calendar-style breakdown of when they have been on shift, making it easy to see their availability patterns at a glance — useful for scheduling or quota reviews.

## Syncing Members from Another Server

If you manage multiple POW servers and want to carry a staff member across, you can use the **Cross-Server Sync** feature:

1. Find the member whose record you want to copy.
2. Click the sync icon.
3. Select the destination server from the dropdown.

This copies their POW member record (role, admin flag) to the other server. They will still need the correct Discord role in the destination server's Discord guild for Auto-Sync to keep them active.

## Removing a Member

To remove someone from the POW member list, use the remove/kick action on their row. This revokes their dashboard access but does **not** affect their Discord account or Roblox account in any way.

{% hint style="info" %}
**Auto-Sync will re-add them** if they still have the Staff Role in your Discord server and Auto-Sync Roles is enabled. To permanently remove someone, remove their Discord role first, then remove them from the POW member list.
{% endhint %}

## Troubleshooting

**A staff member joined Discord but doesn't appear in the Members list.**
* Ensure they have linked their Discord account to their POW profile at [pow.ciankelly.xyz](https://pow.ciankelly.xyz).
* Ensure they have the correct **Staff Role** in your Discord server.
* Ensure **Auto Sync Roles** is enabled in Admin Panel → Settings.

**I removed a member but they can still access the Mod Panel.**
* Check if they still have the Staff Role in Discord. If so, Auto-Sync will re-add them. Remove the Discord role first.
* If they have admin access on a different POW server, that access is scoped to that server only and is not affected.
