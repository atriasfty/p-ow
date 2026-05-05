# Audit Log

The **Audit Log** is a chronological record of security events, administrative actions, and API access for your server. It gives server owners a full picture of who did what, and from where.

{% hint style="info" %}
**Location:** Admin Panel → Audit Log. Only Server Admins and the Server Owner can access this page.
{% endhint %}

## What the Audit Log Records

The following event types appear in the log:

| Category | Examples |
|---|---|
| **Authentication** | Successful logins, session starts, suspicious auth attempts |
| **API Access** | API key created, API key used (endpoint + origin IP) |
| **Settings Changes** | Server settings updated, PRC API key rotated, bot token changed |
| **Security Events** | IP ban triggered, rate limit exceeded, blocked access attempt |
| **Admin Actions** | Member role changed, member promoted to admin, member removed |

Each entry shows:
* **Timestamp** — when the event occurred
* **Event name** — a short description of what happened (e.g. `SETTINGS_UPDATED`, `API_KEY_CREATED`, `AUTH_SUCCESS`)
* **Origin** — whether the action came from the **Dashboard** (web UI) or the **API** (programmatic access)
* **Actor** — the user or API key responsible

## Filtering

Two filters are available at the top of the page:

* **Search Event** — type any keyword to filter by event name (e.g. type `API` to see only API-related events, or `BLOCKED` to see blocked access attempts).
* **Origin** — filter to show only Dashboard events, only API events, or both.

## Use Cases

**Investigating unauthorized changes**
If settings were changed without your knowledge, filter by `SETTINGS_UPDATED` and check the timestamp and actor. This helps identify whether a rogue admin or a compromised API key was responsible.

**Monitoring API key usage**
If you've issued API keys to third-party integrations, filter by `API` origin to see which endpoints are being called and how frequently. Unusual patterns (late-night access, unexpected endpoints) can indicate a leaked key.

**Security audit before a handoff**
Before transferring server ownership or revoking admin access from a staff member, review the audit log to confirm no unexpected changes were made recently.

## Troubleshooting

**The Audit Log is empty.**
* This is normal for newly created servers — events are only recorded going forward from when the server was created on POW.
* Check that you are not applying a filter that excludes all results (try clearing both filters).

**I see events I don't recognize.**
* Filter by `API` origin and check your active API keys in Admin Panel → API Keys. If you see a key you don't recognize or no longer use, revoke it immediately.
