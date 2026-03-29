# POW Vision

**POW Vision** is a companion desktop application designed to run alongside your game. It provides a native, heads-up display of your server's Mod Panel without needing to tab out to a web browser.

{% hint style="info" %}
You can download the latest version of POW Vision directly from the [**GitHub Releases**](https://github.com/atriasfty/p-ow/releases) page.
{% endhint %}

## 1. Installing POW Vision

1. Download the installer for your operating system from the link above.
2. Run the installer. Your operating system might warn you about an unrecognized app; this is normal for new software. Click "More Info" and "Run Anyway".
3. Once installed, POW Vision will open automatically.

## 2. Authenticating POW Vision

For security reasons, POW Vision does not require you to log in with your email and password directly on the desktop app. Instead, it uses a secure pairing code.

1. Open **POW Vision** on your desktop. It will generate a link or display a code.
2. If it gives you a link, open it in your browser. If it gives you a code, visit **[pow.ciankelly.xyz/vision-auth](https://pow.ciankelly.xyz/vision-auth)** and append `?code=YOUR_CODE` to the URL.
3. Log into the main **POW Dashboard** when prompted.
4. The dashboard will generate a **JWT Token**.
5. Copy this token and paste it into the **POW Vision** desktop app to complete the login.
6. Your desktop app will now be connected to your account!

## 3. Using POW Vision

POW Vision provides a streamlined version of the Mod Panel, optimized for quick actions while gaming.

* **Always on Top:** You can configure POW Vision to stay on top of your game window.
* **Quick Actions:** Execute moderation actions (Warn, Kick, Ban, BOLO) with a few clicks without typing commands.
* **Player Scanning:** Press the hotkey to scan the screen and instantly pull up a player's profile and punishment history.

{% hint style="warning" %}
**Keep Your Session Secure:** POW Vision keeps you logged in. If you are playing on a shared computer, be sure to log out of the desktop app when you are finished!
{% endhint %}

## Troubleshooting

**Error: "Invalid or expired code"**

* **Fix:** Pairing codes expire after a few minutes. If you took too long, simply close and reopen POW Vision to generate a new code, then try again.

**POW Vision isn't showing my servers.**

* **Fix:** Ensure you authenticated with the correct POW account. If your web dashboard doesn't show any servers either, you need to be invited to a server or link your Discord/Roblox accounts first.

**The app is lagging or not updating.**

* **Fix:** Check your internet connection. POW Vision relies on a stable connection to sync with the main POW servers. Try restarting the application.
