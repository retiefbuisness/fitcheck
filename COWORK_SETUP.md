# Fit Check: set up GitHub, Vercel and Supabase

**Instructions for Claude Cowork.** Follow these steps in order on the user's Windows PC. The goal:

1. The whole `fitcheck` folder (`C:\Users\nunes\OneDrive\fitcheck`) is under **Git** version control and pushed to a **private GitHub repository**.
2. The two existing **Vercel** projects deploy automatically from that GitHub repository on every push.
3. **Supabase** stays the backend. It is already set up; you connect the repo to it and finish the auth settings.

---

## Ground rules

- **The user signs in themselves.** When a step needs GitHub, Vercel or Supabase, open the page and ask the user to sign in or approve. Never type their passwords, and never create accounts for them.
- **Never commit secrets.** No Supabase service-role/secret keys, database passwords, `.env` files, Android keystores (`*.jks`, `*.keystore`), or tokens. The Supabase **publishable** key (`sb_publishable_...`) in `mobile/src/config.ts` and `web/src/config.ts` is public by design, so it is fine to commit.
- **Don't recreate what exists.** Do not create a new Supabase project, re-run the SQL migrations, or delete or recreate the Vercel projects.
- **Keep the legal pages public.** Google Play requires the privacy policy, terms, child safety and account deletion pages to be reachable without logging in. Leave Vercel Deployment Protection **off** on both projects.
- Ask the user before anything that costs money or changes a paid plan.

---

## What already exists

| Thing | Details |
|---|---|
| Project folder | `C:\Users\nunes\OneDrive\fitcheck` (inside OneDrive; see the OneDrive note below). It was copied **without** `node_modules`, so no packages are installed here. That's fine: nothing in these steps needs them, because Vercel and GitHub build in the cloud. |
| `mobile/` | Android app (Expo SDK 57, React Native). Has its own `package.json` and `package-lock.json`. |
| `web/` | Web app (Vite + React + TypeScript). Has its own `package.json` and `package-lock.json`. |
| `website/` | Static legal pages (plain HTML + CSS, no build step). |
| `supabase/` | `migrations/` (3 SQL files, **already applied**) and `functions/delete-account/` (**already deployed**). |
| `design/` | Icon and store graphics, plus `make-assets.js` that renders them. |
| Root `.gitignore` | Already excludes `node_modules/`, `mobile/android/`, `builds/`, `*.apk`, `*.aab`, keystores, `.env*`, `.claude/`, Supabase temp folders. `mobile/` and `web/` have their own `.gitignore` too. |
| Node.js | **Portable** install, not on the system PATH. In each PowerShell session run: `$env:PATH = "$env:USERPROFILE\tools\node-v24.19.0-win-x64;$env:PATH"` |
| Git | **Not installed yet** (see step 1). |
| Supabase project | Name "retiefbuisness's Project", ref `vtghnxijqqjuonzdinmr`, region `eu-west-1`, URL `https://vtghnxijqqjuonzdinmr.supabase.co` |
| Vercel team | `NorthBridgeDigital` (the only team on the user's Vercel login) |
| Vercel project `fitcheck-web` | The web app. Live at https://fitcheck-web-lemon.vercel.app. Framework Vite, build `npm run build`, output `dist`. Currently deployed by direct upload, with no Git connection. |
| Vercel project `fitcheck-legal` | The legal pages. Live at https://fitcheck-legal-two.vercel.app. Static, no build. Currently direct upload, no Git connection. |

**Windows note:** this is Windows PowerShell 5.1. `Set-Content` / `Out-File -Encoding utf8` add a byte-order mark that breaks `package.json` and other JSON files. Edit files with a normal editor or write UTF-8 **without** BOM.

**OneDrive note:** the project lives inside OneDrive, which syncs every file.
- **Don't run `npm install` in this folder** unless the user asks. It creates `node_modules` folders with tens of thousands of files that OneDrive would try to upload. If a local build is ever needed, first ask the user to pause OneDrive sync (OneDrive tray icon → Pause syncing).
- If a Git command fails with "file in use" or "permission denied", OneDrive is probably syncing that file. Wait a few seconds and retry.
- The `.git` folder will sync to OneDrive too. That's okay as a backup, but GitHub is the real source of truth.

---

## Step 1: Install Git

Pick one:

- **Option A (recommended):** in PowerShell run `winget install --id Git.Git -e --source winget`. Windows shows an **administrator prompt**, so tell the user to look for it (it can hide behind other windows, or show as a flashing shield on the taskbar) and click **Yes**. Earlier, a Node.js install stalled for a long time because nobody saw that prompt.
- **Option B (no admin needed):** have the user install **GitHub Desktop** from https://desktop.github.com. It includes Git and handles GitHub sign-in.

Then open a **new** PowerShell window and check with `git --version`.

Set the commit identity. **Ask the user** what name to use. For the email, suggest their GitHub "noreply" address (GitHub → Settings → Emails) so their real email isn't published in the commit history:

```
git config --global user.name "<name the user chooses>"
git config --global user.email "<email the user chooses>"
git config --global init.defaultBranch main
```

## Step 2: Create the GitHub repository

1. Ask the user to sign in at https://github.com (or create an account themselves).
2. Create a new repository:
   - Name: `fitcheck`
   - Visibility: **Private**
   - **Do not** add a README, .gitignore or license, because the folder already has them.
3. Copy the repository URL, e.g. `https://github.com/<user>/fitcheck.git`.

## Step 3: First commit (with a safety check)

In PowerShell:

```
cd C:\Users\nunes\OneDrive\fitcheck
git init
git add .
git status
```

**Before committing, check what is staged:**

- `git status` must **not** list anything under `node_modules/`, `mobile/android/`, `web/dist/`, `.claude/`, or any `.env`, `.jks`, `.keystore`, `.apk`, `.aab` file.
- Search the staged files for secrets. These should return **nothing**:
  ```
  git grep -n -I -E "sb_secret_|service_role|SUPABASE_SERVICE_ROLE_KEY=|-----BEGIN (RSA |EC )?PRIVATE KEY" --cached
  ```
  A match in `supabase/functions/delete-account/index.ts` that only *reads* `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` is fine: it's a variable name, not a key. Any actual key value is not fine. If you find one, stop and ask the user.
- Expected size: roughly 125 files and about 1 MB. Thousands of files means `node_modules` slipped in, so fix the `.gitignore` first.

Then commit and push:

```
git commit -m "Fit Check: Android app, web app, Supabase backend, legal site"
git remote add origin https://github.com/<user>/fitcheck.git
git push -u origin main
```

On the first push, Git for Windows opens a browser window to sign in to GitHub (Git Credential Manager). **Let the user complete that sign-in.** With GitHub Desktop, use **File → Add local repository → Publish repository** (keep "Private" ticked) instead.

## Step 4: Optional automatic checks on every push

Create `.github/workflows/ci.yml` with the content below. It type-checks, builds and lints both apps on GitHub's servers, which is useful because the user's PC is slow. Commit and push it.

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  web:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run build
      - run: npm run lint

  mobile:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: mobile
    env:
      CI: "1"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: mobile/package-lock.json
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx expo lint
```

Check the **Actions** tab on GitHub. Both jobs should go green. If one fails, show the user the error rather than guessing.

## Step 5: Connect Vercel to GitHub

Ask the user to sign in at https://vercel.com and switch to the **NorthBridgeDigital** team (team switcher, top left).

### 5a. `fitcheck-web` (the web app)

1. Open project **fitcheck-web** → **Settings → Git** → **Connect Git Repository** → GitHub → choose `fitcheck`.
   - If Vercel asks to install or configure the **Vercel GitHub App**, the user approves access to the `fitcheck` repository.
2. **Settings → Build and Deployment**:
   - Root Directory: `web`
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install` (or leave default)
   - Node.js Version: 24.x
3. **Settings → Git**: Production Branch = `main`.
4. Optional **Settings → Environment Variables**, for Production and Preview. The code already falls back to these same values, so this only makes them visible in Vercel:
   - `VITE_SUPABASE_URL` = `https://vtghnxijqqjuonzdinmr.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_rMtrTXN63O7A50jbSKry7Q_iMm6xmmH`
5. **Settings → Deployment Protection**: make sure **Vercel Authentication is Disabled**.
6. Go to **Deployments → Redeploy** the latest, or push any small commit. Wait until it shows **Ready**.

### 5b. `fitcheck-legal` (the legal pages)

1. Same as above, but connect the same `fitcheck` repository to project **fitcheck-legal**.
2. **Settings → Build and Deployment**:
   - Root Directory: `website`
   - Framework Preset: **Other**
   - Build Command: leave empty / off
   - Output Directory: leave default (the root directory itself)
3. Production Branch = `main`. Deployment Protection must be **Disabled**.
4. Redeploy and wait for **Ready**.

Both projects now watch the same repository. A push rebuilds whichever one's folder changed. If both always rebuild, that's fine.

### If Vercel won't let you connect

The user's role in NorthBridgeDigital may be limited. Earlier, creating a project through a deployment failed with "You don't have permission to create a project".

- First, ask the user whether they can get the needed role from the team owner.
- Otherwise, fall back to the user's **personal** Vercel account (Hobby): **Add New → Project → Import** the `fitcheck` repo twice, once with Root Directory `web` (Vite) and once with `website` (Other). The addresses will change. If they do, **update every reference**:
  - `web/src/config.ts` → `WEBSITE_URL` (legal site)
  - `mobile/src/config.ts` → `WEBSITE_URL` (legal site)
  - `PLAY_STORE.md` and `README.md` (both URLs)
  - Supabase auth URLs (step 6)

  Then commit and push. Don't delete the old NorthBridgeDigital projects without asking the user.

### Check it worked

Each of these should return **200** in a browser or with `curl -I`:

- https://fitcheck-web-lemon.vercel.app/
- https://fitcheck-web-lemon.vercel.app/post/test (must show the app, not a 404; `web/vercel.json` rewrites all paths to `index.html`)
- https://fitcheck-legal-two.vercel.app/privacy.html
- https://fitcheck-legal-two.vercel.app/delete-account.html

Then check the Vercel **Deployments** list shows the new deployment's **source as GitHub** (commit message and branch `main`), not a manual upload.

## Step 6: Supabase (the backend)

Supabase is already the backend. Do **not** create a new project. Ask the user to sign in at https://supabase.com/dashboard and open project `vtghnxijqqjuonzdinmr`.

### 6a. Auth settings (required for sign-up to work)

**Authentication → URL Configuration**:

- **Site URL:** `https://fitcheck-web-lemon.vercel.app`
- **Redirect URLs**, add both:
  - `https://fitcheck-web-lemon.vercel.app/**` (web app)
  - `fitcheck://**` (Android app)

**Authentication → Sign In / Providers → Email**, pick one with the user:

- **For testing:** turn **Confirm email** off. Supabase's built-in sender only sends a few emails per hour, which would block new testers.
- **Before public launch:** keep confirmation on and set up custom SMTP (**Authentication → Emails → SMTP Settings**) with a provider the user signs up for. The user enters those credentials themselves.

### 6b. Link the repo to Supabase for future database changes (recommended)

This makes `supabase/` in Git the source of truth, so future changes go database → Git → Supabase through the Supabase CLI.

```
cd C:\Users\nunes\OneDrive\fitcheck
$env:PATH = "$env:USERPROFILE\tools\node-v24.19.0-win-x64;$env:PATH"
npx supabase@latest login
npx supabase@latest init
```

- `login` opens a browser. **The user approves it.**
- `init` creates `supabase/config.toml` and must **not** touch `supabase/migrations/` or `supabase/functions/`. Answer **No** to the VS Code / Deno settings questions.

Then open `supabase/config.toml` and add this at the end. The `delete-account` function checks the user's token itself and is deployed with JWT verification off, so the CLI must keep it that way:

```toml
[functions.delete-account]
verify_jwt = false
```

Link and verify:

```
npx supabase@latest link --project-ref vtghnxijqqjuonzdinmr
npx supabase@latest migration list
```

- `link` may ask for the **database password**. **The user types it**, or presses Enter to skip. Never save it in a file.
- `migration list` must show these three with **both Local and Remote filled in**:

  | Version | Name |
  |---|---|
  | 20260929130704 | init |
  | 20260929130806 | lock_down_functions |
  | 20260930091917 | tighten_grants |

  They already match, because the local files were renamed to Supabase's recorded versions. If any row shows only Local or only Remote, **stop and ask the user**. Do **not** run `db push` or `migration repair`, because that could re-run the migrations or drop data.

Commit `supabase/config.toml` and push. Check `git status` first: `supabase/.temp/` is ignored and must not be committed.

**For future database changes** (tell the user; don't do it now):

```
npx supabase@latest migration new <short_name>    # creates a file in supabase/migrations/, edit it
npx supabase@latest db push                         # applies it to the live database
npx supabase@latest functions deploy delete-account --no-verify-jwt   # only if the function changes
```

Then commit the new migration file to Git.

**Optional: Supabase ↔ GitHub integration** (Project Settings → Integrations → GitHub) can apply migrations automatically when `main` changes. It relies on Supabase Branching, which may need a **paid plan**. **Ask the user before enabling anything that costs money.** The CLI flow above is free.

### 6c. Don't change

- The database tables, row-level security policies, storage buckets and triggers. They're tested (25 of 25 security checks passed).
- The publishable key. If the user ever rotates it, update `mobile/src/config.ts`, `web/src/config.ts` and the Vercel env vars together.

## Step 7: Final checklist

- [ ] `git log` shows the initial commit; GitHub shows the repository as **Private**.
- [ ] No `node_modules`, `android/`, `dist/`, `.env`, keystores or secret keys are on GitHub (search the repo on github.com for `sb_secret_` and `service_role` to be sure).
- [ ] GitHub Actions CI is green (if step 4 was done).
- [ ] Both Vercel projects are connected to GitHub, and the latest deployments came from a GitHub commit on `main`.
- [ ] Deployment Protection is off on both; the four URLs in step 5 return 200.
- [ ] Supabase Site URL and both Redirect URLs are set, and the email confirmation choice is made.
- [ ] `npx supabase migration list` shows all three migrations as matched (if step 6b was done).
- [ ] Sign up on https://fitcheck-web-lemon.vercel.app with a real email, add a closet item with a photo, and post a fit. The user does this with their own details.

## Step 8: Report back to the user

Tell the user, in plain language:

- The GitHub repository address, and that it's private.
- Whether each Vercel project is now connected, and its live address.
- Which Supabase settings were changed.
- How to update the app from now on: edit files → commit → push to `main` → Vercel redeploys automatically; database changes go through `supabase migration new` + `supabase db push`.
- Anything that failed or was skipped, with the exact error message.
