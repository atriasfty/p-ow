# Forms & Recruitment Applications

Project Overwatch includes a powerful, built-in Form Builder. You can use it to create general surveys, ban appeals, or full recruitment applications for your staff team.

## 1. Creating a Form

1. From the dashboard, select your server and navigate to **Forms** in the sidebar.
2. Click **Create Form**.
3. You will be taken to the Form Editor. 

### The Form Editor
The editor uses a drag-and-drop interface. You can:
* **Add Sections:** Break long forms into multiple pages.
* **Add Questions:** Choose from Short Answer, Long Answer, Multiple Choice, Checkboxes, Dropdowns, Scales, Dates, Times, or File Uploads.
* **Conditional Logic:** Click the gear icon next to a question to set rules. For example, only show "Why were you banned?" if they select "Yes" to "Have you been banned before?".

## 2. Form Settings & Sharing

Click the **Settings** button in the top right of the Form Editor to configure how your form behaves.

### Access Settings
* **Require login:** Users must have a POW account to fill out the form.
* **Anonymous responses:** Hide the respondent's username/email from the results.
* **Allow multiple:** Let users submit the form more than once.
* **Max responses & Expiration:** Set limits on when and how many times the form can be filled.

### Discord Role Gating
You can restrict who is allowed to view and submit the form based on their Discord roles.
* **Required Roles (Whitelist):** The user *must* have one of these roles in your Discord server.
* **Ignored Roles (Blacklist):** If the user has any of these roles, they are *blocked* from the form (e.g., a "Blacklisted" role).

### Sharing Your Form
In the settings panel, you will find two links:
1. **Public Link:** Share this link with your community so they can fill out the form.
2. **Editor Link:** Share this link *privately* with other admins. Anyone who opens this link while logged into **[pow.ciankelly.xyz](https://pow.ciankelly.xyz)** will be granted edit access to the form.

## 3. Recruitment Workflow (Staff Applications)

POW can automatically handle the hiring process for your server.

### Setting up an Application
1. Open your form and click **Settings**.
2. Scroll down to **Recruitment Workflow**.
3. Toggle **Recruitment Application** to ON.
4. Configure the following:
   * **Recruitment Review Channel:** Select a Discord channel. Every time an application is submitted, POW will send a summary embed to this channel with a link to review it.
   * **Staff Role to Grant:** Select the Discord role that should be given to the user if they pass the application (e.g., "Trainee Moderator").
   * **Celebration Channel:** Select a public Discord channel where POW will announce their promotion if accepted!

### Reviewing Applications
1. When a user submits an application, go to the **Forms** page and click **Results** next to your form.
2. Review their answers.
3. If the form is marked as a **Recruitment Application**, you will see **Accept** and **Decline** buttons.

**If Accepted:**
* POW automatically assigns them the "Staff Role to Grant" in your Discord server.
* POW posts a congratulatory message in the "Celebration Channel".
* Due to Auto-Join, the user immediately gains access to the Mod Panel based on their new Discord role!

## Troubleshooting

**A user submitted a form, but they didn't get the role when I clicked Accept.**
* **Fix:** The user must have their Discord account linked to their POW profile on **[pow.ciankelly.xyz](https://pow.ciankelly.xyz)**. If they filled it out anonymously or without logging in, POW doesn't know which Discord account to give the role to. Ensure "Require login" is checked in the form settings. Also, ensure the POW Bot's role is higher than the role you are trying to grant.

**I set up conditional logic, but the question is always showing.**
* **Fix:** Check your logic carefully. If you are comparing against a Checkbox (which can have multiple answers), use the "contains" or "equals" operator carefully. Ensure the exact spelling of the option matches.

**Staff are getting a "Permission Denied" error when clicking the Editor Link.**
* **Fix:** Ensure they are logged into POW before clicking the link. The Editor Link permanently grants their specific account access to edit the form.