# What MSR Tracker needs from you

Everything below is a setting or an account only you can create. Do them in this order. Each step says why it matters and what breaks without it.

Your live app is `https://msr-bug-tracker.onrender.com`. All the new work is on the branch `claude/app-feature-roadmap-ap7xa3`. It goes live once you merge that branch into the branch Render deploys from, usually `main`.

> **Do step 1 before you merge.** The new server refuses to start in production without `ENCRYPTION_KEY`, so the site would go down.

## Checklist

| #   | What                                   | Needed for                                               | Urgency                                  |
| --- | -------------------------------------- | -------------------------------------------------------- | ---------------------------------------- |
| 1   | `ENCRYPTION_KEY` on Render             | The server starting at all                               | **Before merging**                       |
| 2   | Upgrade the Render database            | Keeping your data                                        | **Before 2026-11-24**, when it's deleted |
| 3   | Upgrade the web service and add a disk | Attachments that survive deploys, calendar sync, imports | Strongly recommended                     |
| 4   | Resend account, domain and API key     | Verification, password-reset and invite emails           | Required for email                       |
| 5   | Google Cloud OAuth client              | "Connect Google Calendar"                                | Optional                                 |
| 6   | Custom domain                          | A nicer URL, and verifying the Google app                | Optional                                 |
| 7   | App Store and Play Store listings      | Native store apps (the PWA works without them)           | Optional                                 |

Nothing is needed from you for:

- iCloud calendars, the calendar feed and AI keys
- invites, CSV/Excel import and export, and migrations from other tools
- 2FA and households

Each user does their own part of those inside the app (see "Things users set up themselves").

---

## 1. `ENCRYPTION_KEY` (before merging)

The app encrypts 2FA secrets, saved AI keys and calendar passwords and tokens with this key.

1. Generate a key on any computer:
   ```bash
   openssl rand -base64 32
   ```
   No OpenSSL? Use `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` instead.
2. In Render, open **msr-bug-tracker → Environment → Add Environment Variable**. Set the key to `ENCRYPTION_KEY` and paste the value. Save. Render restarts the service, which is harmless on the current version.
3. Store the value in your password manager.

**Never change or lose it.** With a different key, every user would have to set up 2FA again, re-enter their AI keys and reconnect their calendars. The server checks the format on startup: it must be 32 bytes, base64-encoded.

Your service was created by hand, not from `render.yaml`. The Blueprint's `generateValue` for this key doesn't apply to it, so set it yourself as above.

## 2. Upgrade the database (before 2026-11-24)

Your `msr` Postgres database is on Render's **free** plan, and Render lists it as **expiring on 2026-11-24**. A free database is deleted after it expires, together with every project, task and user.

1. In Render, open the database, then **Upgrade** (or **Change instance type**). Pick a paid instance; the smallest one is enough for now.
2. Nothing in the app changes: the connection string stays the same.

Paid instances also get daily backups, and point-in-time recovery on some plans. `scripts/backup.sh` (see the README) can take extra backups to your own machine.

## 3. Upgrade the web service and add a disk (strongly recommended)

The web service is also on the **free** plan, which has three problems:

- **No persistent disk.** Uploaded attachments are lost on every deploy or restart.
- **It sleeps after 15 minutes without traffic.** The next visit takes up to a minute to wake it. While it sleeps, the 5-minute Google and iCloud background sync and running imports stop.
- **Outbound SMTP ports are blocked.** Email works anyway through Resend, which uses HTTPS (step 4).

What to do:

1. **msr-bug-tracker → Settings → Instance type → Starter** (about $7/month; check Render's pricing page).
2. **Disks → Add disk**: any name, mount path `/var/data/uploads`, size 1 GB.
3. **Environment**: set `UPLOAD_DIR` to `/var/data/uploads`.

## 4. Email through Resend (required for email)

Without this, verification, password-reset and invite emails are never sent. The links are only written to the Render log, which is why "verify email" didn't work.

1. Create an account at [resend.com](https://resend.com).
2. **Domains → Add domain**: use a domain you own, ideally a subdomain such as `mail.yourdomain.com`.
3. Resend shows DNS records (SPF, DKIM, and an MX record for bounces). Add them exactly as shown at your domain registrar or DNS host. Wait until Resend shows **Verified**, usually minutes and at most a few hours.
4. **API Keys → Create API key**: permission **Sending access**, restricted to that domain. Copy the key (it starts with `re_`).
5. In Render, under **Environment**, add:
   - `RESEND_API_KEY`: the key from step 4
   - `MAIL_FROM`: for example `MSR Tracker <no-reply@mail.yourdomain.com>`. The address must be on the verified domain.
6. Check it worked: register a test account. Its verification email should arrive within a minute. If not, the Render log shows the Resend error.

Accounts that registered before this can verify from the yellow banner (**Resend link**) once Resend is live. You can also open the links already printed in your Render logs.

## 5. Google Calendar (optional)

Without this, everything else works, but the **Connect Google Calendar** button is hidden and users see "Google Calendar isn't set up on this server yet".

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project, for example "MSR Tracker".
2. **APIs & Services → Library**: search for **Google Calendar API** and click **Enable**.
3. **Google Auth Platform** (formerly "OAuth consent screen"):
   - **Branding**: app name "MSR Tracker", your support email, and your developer contact email.
   - **Audience**: **External**. While the app is in **Testing**, add each person who will connect a calendar under **Test users** (up to 100).
   - **Data access**: add the scopes `openid`, `.../auth/userinfo.email` and `https://www.googleapis.com/auth/calendar`.
4. **Clients → Create client → Web application**. Under **Authorized redirect URIs**, add:
   - `https://msr-bug-tracker.onrender.com/api/calendar/google/callback`
   - `http://localhost:5173/api/calendar/google/callback` (only if you run the app locally)
5. Copy the client ID and client secret into Render as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Know the limits of **Testing** mode:

- Only the test users you listed can connect.
- Google expires their connection after **7 days**. Users then see a sync error and must reconnect in Settings → Calendars.

To remove both limits, click **Publish app**. Because the calendar scope is "sensitive", Google then asks for verification:

- a home page and privacy policy on a domain you own (step 6), and a short video of the flow
- a review that takes days to weeks

Until it's verified, users see a "Google hasn't verified this app" screen. They can continue through **Advanced**.

## 6. Custom domain (optional)

1. In Render, open **Settings → Custom Domains → Add**, then create the DNS record it shows.
2. Set `APP_URL` to the new origin, for example `https://tracker.yourdomain.com`. Email links, invite links, QR codes, the calendar feed and Google sign-in all use it.
3. Add `https://<new domain>/api/calendar/google/callback` to the Google client's redirect URIs.

Calendar feed links that users have already subscribed to contain the old address. They need to copy the new link from Settings → Calendars.

## 7. App stores (optional)

The app is a PWA. The **Install** QR code and the `/install` page show iPhone and Android users how to add it to their home screen, and nothing else is required.

Listing it in the stores would need:

- an Apple Developer Program membership (US$99/year)
- a Google Play developer account (US$25 once)
- a native wrapper, for example Capacitor, which I haven't built

---

## Things users set up themselves

| Feature                  | What each user does                                                                                                                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iCloud calendar          | Turn on two-factor authentication for their Apple Account, create an app-specific password at [account.apple.com](https://account.apple.com) → Sign-In and Security → App-Specific Passwords, then paste it in Settings → Calendars → Connect iCloud Calendar                                                                               |
| Calendar feed (any app)  | Settings → Calendars → Create my calendar link, then subscribe from Outlook, Google, Apple or Android, or scan the QR code                                                                                                                                                                                                                  |
| Very important events    | Star the event in MSR. In Google, color it **Tomato**. Or switch on "Very important" for a whole calendar in Settings → Calendars                                                                                                                                                                                                           |
| Two-factor sign-in       | Settings → Security, then scan the QR code with Google Authenticator or Microsoft Authenticator. Keep the recovery codes                                                                                                                                                                                                                    |
| AI keys                  | Settings → AI, then paste a Claude, ChatGPT, Gemini or Grok API key. Each key is tested before it's saved                                                                                                                                                                                                                                   |
| Moving from another tool | Projects → Import. Each tool asks for the user's own token, and the dialog links to where to create it: ClickUp (Settings → Apps), Jira (Atlassian API tokens), Trello (Power-Up admin), Asana (developer console), Linear (Security & access) and GitHub (fine-grained token with read-only Issues). Tokens are used once and never stored |
| Households               | New project → Household, then invite the family. **Parent** can do everything. **Child** can only take and finish their own chores and edit the shopping lists. **Guest** can only look                                                                                                                                                     |

## Environment variables at a glance

| Variable                                   | Value                                         | Required                                     |
| ------------------------------------------ | --------------------------------------------- | -------------------------------------------- |
| `DATABASE_URL`                             | Already set by Render                         | Yes                                          |
| `ENCRYPTION_KEY`                           | Output of `openssl rand -base64 32`           | Yes, in production                           |
| `RESEND_API_KEY`                           | `re_…` from Resend                            | For email                                    |
| `MAIL_FROM`                                | `MSR Tracker <no-reply@your-verified-domain>` | For email                                    |
| `UPLOAD_DIR`                               | `/var/data/uploads` (with the disk)           | Recommended                                  |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | From the Google Cloud web client              | For Google Calendar                          |
| `APP_URL`                                  | Your custom domain's origin                   | Only with a custom domain                    |
| `ENABLE_DEMO_DATA`                         | `true` (default) or `false`                   | Optional: `false` hides Settings → Demo data |

## What I couldn't test here

The sandbox can't reach outside services. These parts were therefore built to each provider's documentation and tested against recorded or mocked responses, but never against the live service:

- sending through Resend
- Google and iCloud calendar sync
- AI key checks
- the six migration APIs: ClickUp, Jira, Trello, Asana, Linear and GitHub

After you complete steps 4 and 5, try each one once: send a test email, connect a calendar, add a key and import one small project. Send me any error from the Render log and I'll fix it.
