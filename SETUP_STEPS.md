# Fit Check: your setup steps (GitHub Desktop + Vercel + Supabase)

Written for Retief on 30 Sep 2026. It replaces the command-line parts of `COWORK_SETUP.md` with button-clicking steps.
**You (👤)** do the sign-ins and clicks. **Claude (🤖)** does the parts marked for Claude from the chat.

Order: **1 GitHub → 2 CI check → 3 Vercel → 4 Supabase → 5 Test.** Tell Claude when you finish each part.

---

## ✅ Already done by Claude

- Checked your live Supabase database: **RLS is ON for all 12 tables** (blocks, closet_items, comments, follows, likes, notifications, post_ratings, post_tags, posts, profiles, reports, saved_outfits) and for storage, all with policies.
- Fixed the one gap found: the helper function `rls_auto_enable` could be called by any signed-in user. It's now locked (migration `20260930110504_lock_rls_auto_enable`, applied live and saved in `supabase/migrations/`).
- Left alone on purpose: `username_available` stays callable, because the sign-up screen needs it to check if a username is free.

---

## Part 1: Put the code on GitHub (👤 about 15 min)

### 1.1 GitHub account
1. Go to https://github.com and sign in with the account you chose (or create one).
2. Top-right avatar → **Settings** → **Emails**.
3. Tick **Keep my email addresses private**. Copy the address that looks like `12345678+username@users.noreply.github.com`. You'll use it in 1.2, so your real email isn't public in the history.

### 1.2 Install GitHub Desktop
1. Go to https://desktop.github.com → **Download for Windows** → run the file. No admin prompt needed.
2. When it opens: **Sign in to GitHub.com** → your browser opens → **Authorize desktop** → go back to the app.
3. **Configure Git** screen:
   - Name: whatever you want shown on your changes (e.g. `Retief`)
   - Email: paste the **noreply** address from 1.1
   - Click **Finish**.

### 1.3 Turn the fitcheck folder into a repository
1. In GitHub Desktop: **File → Add local repository…**
2. **Choose…** → pick `C:\Users\nunes\OneDrive\fitcheck` → **Select Folder**.
3. It says *"This directory does not appear to be a Git repository"*. Click the blue link **create a repository**.
4. In the **Create a new repository** box:
   - Name: `fitcheck`
   - Description: `Fit Check app` (optional)
   - **Do NOT tick** "Initialize this repository with a README"
   - Git ignore: **None** (the folder already has one)
   - License: **None**
   - Click **Create repository**.

### 1.4 Safety check (before anything leaves your PC)
1. Click the **History** tab (top-left) → click the **Initial commit**.
2. Look at the file list on the left. You should see about **130 files**, in `mobile/`, `web/`, `website/`, `supabase/`, `design/` and a few in the top folder.
3. There must be **nothing** from: `node_modules`, `mobile/android`, `web/dist`, `.claude`, or any file ending in `.env`, `.jks`, `.keystore`, `.apk`, `.aab`.
4. If you see thousands of files or any of those, **stop and tell Claude.** Nothing has been uploaded yet, so it's safe.

> If Windows/OneDrive shows "file in use" errors, OneDrive is syncing. Wait 10 seconds and try again.

### 1.5 Publish (upload) it as a PRIVATE repository
1. Click **Publish repository** (top bar).
2. Name: `fitcheck`. **Keep "Keep this code private" TICKED.**
3. Click **Publish repository**.
4. Check on github.com: your repository list shows `fitcheck` with a **Private** label.

➡️ **Tell Claude:** "Repo is up" + your GitHub username.

---

## Part 2: Automatic checks on every upload (👤 3 min, optional but recommended)

Claude couldn't create this file in your folder (Windows protects `.github` from remote tools), so add it on the website:

1. On github.com open your `fitcheck` repo → **Add file → Create new file**.
2. File name: type exactly `.github/workflows/ci.yml` (the `/` makes the folders).
3. Paste the contents of `ci.yml` (Claude sent it in the chat).
4. Click **Commit changes…** → **Commit changes**.
5. Back in **GitHub Desktop**: click **Fetch origin**, then **Pull origin**. This brings the file to your PC. **Always do this after changing anything on the website**, or you'll get conflicts.
6. On github.com open the **Actions** tab. Wait a few minutes. Both **web** and **mobile** should get a green tick. A red cross? Click it and send Claude a screenshot of the error.

---

## Part 3: Vercel hosting (👤 3 min, then 🤖)

You chose **new projects on the basilwmotion Vercel account** (team NorthBridgeDigital). The web addresses will change.

### 3.1 👤 Give Vercel access to your repo
1. Go to https://vercel.com and sign in as **basilwmotion@gmail.com**. Top-left team switcher → **NorthBridgeDigital**.
2. **Add New… → Project**.
3. Under *Import Git Repository*, open the account dropdown → **Add GitHub Account** (or **Adjust GitHub App Permissions**).
4. GitHub opens: pick the account that owns `fitcheck` → **Only select repositories** → choose `fitcheck` → **Install** (or **Save**).
5. You're back on Vercel and `fitcheck` is in the list. **Stop here, don't click Import.** Tell Claude.

### 3.2 🤖 Claude does this from the chat
- Creates project **fitcheck-web**: root folder `web`, Vite, build `npm run build`, output `dist`, Supabase URL + publishable key env vars, login protection OFF.
- Creates project **fitcheck-legal**: root folder `website`, no build, login protection OFF (Google Play needs these pages public).
- Checks that both deploy from GitHub `main` and that the pages load.
- Updates the new addresses in `web/src/config.ts`, `mobile/src/config.ts`, `README.md` and `PLAY_STORE.md` in your folder.

### 3.3 👤 Upload Claude's changes
In GitHub Desktop you'll see the changed files. Bottom-left: Summary `Use new Vercel addresses` → **Commit to main** → **Push origin**. Vercel redeploys by itself.

> The old projects (`fitcheck-web-lemon…`, `fitcheck-legal-two…`) on your other Vercel login are left untouched. Don't delete them until the new ones work.

> **Possible issue:** Vercel's free (Hobby) plan can block a deployment when the GitHub account that made the change isn't the one linked to the Vercel login (BasilwMotion). If a deployment says **"Blocked"**, tell Claude and we'll fix it.

---

## Part 4: Supabase sign-in settings (👤 about 10 min)

Do this **after** Part 3, because it needs the new web address (Claude will give it to you).
Sign in at https://supabase.com/dashboard → project **retiefbuisness's Project** (`vtghnxijqqjuonzdinmr`).

### 4.1 Web addresses
**Authentication → URL Configuration**
- **Site URL:** `<new fitcheck-web address from Claude>` → **Save**
- **Redirect URLs → Add URL**, add both:
  - `<new fitcheck-web address>/**`
  - `fitcheck://**` (the Android app)

### 4.2 Email confirmation ON
**Authentication → Sign In / Providers → Email**: make sure **Confirm email** is **ON** → **Save**.

### 4.3 Your own email sender (SMTP)
Supabase's built-in sender only sends ~2 emails an hour, so testers get stuck without this.
**Authentication → Emails → SMTP Settings** → turn on **Enable custom SMTP**, then fill in:

| Field | What to enter |
|---|---|
| Sender email | an address on your provider, e.g. `no-reply@yourdomain.com` |
| Sender name | `Fit Check` |
| Host | from your provider |
| Port | from your provider (usually `587`) |
| Username | from your provider |
| Password | from your provider. **You type this yourself. Never paste it in the chat or in any file.** |

Click **Save**. Claude will give you the exact host/port/username for your provider once you say which one.

Then **Authentication → Rate Limits**: check *"Rate limit for sending emails"*. Raise it to about **100 per hour** if it's lower.

### 4.4 Skipped on purpose
- **Leaked password protection** needs a paid Supabase plan. Only turn it on if you upgrade.
- **Supabase ↔ GitHub integration** can also cost money, so it's skipped.
- **Supabase CLI linking** (COWORK_SETUP step 6b) needs the command line. It's skipped because you don't want to use it. Instead, Claude makes future database changes through the Supabase connection and saves the migration file in `supabase/migrations/`. You then commit it in GitHub Desktop.

---

## Part 5: Final test (👤 5 min)

1. Open the new fitcheck-web address in a private/incognito window.
2. Sign up with a **real** email → open the confirmation email → click the link. It should take you back to the app, signed in.
3. Add a closet item with a photo, then post a fit.
4. Open `<new legal address>/privacy.html` and `/delete-account.html`. Both should load without a login.

---

## How to update the app from now on

1. Change files in the `fitcheck` folder (or ask Claude to).
2. Open **GitHub Desktop**. Changed files appear on the left.
3. Type a short **Summary** (e.g. `Fix sign-up button`) → **Commit to main** → **Push origin**.
4. Vercel rebuilds the website automatically in 1–2 minutes. GitHub runs the checks (Actions tab).
5. **Database changes:** ask Claude. It applies them through Supabase and saves the migration file. You commit + push it like any other change.
6. Changed something on github.com? Click **Fetch origin → Pull origin** in GitHub Desktop first.
