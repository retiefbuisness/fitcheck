# Fit Check: Google Play launch guide

Everything you need to enter into Google Play Console, in order.

## 0. Before you start

- [ ] Google Play developer account ($25 one-time): https://play.google.com/console/signup
- [ ] Expo account (free): https://expo.dev/signup (used to build the Play Store version in the cloud)
- [x] Support email: retiefbuisness@gmail.com (in the legal pages and the app)
- [x] Legal pages published (Vercel project `fitcheck-legal`):
  - Home: https://fitcheck-legal-two.vercel.app/
  - Privacy policy: https://fitcheck-legal-two.vercel.app/privacy.html
  - Terms: https://fitcheck-legal-two.vercel.app/terms.html
  - Child safety standards: https://fitcheck-legal-two.vercel.app/child-safety.html
  - Account deletion: https://fitcheck-legal-two.vercel.app/delete-account.html
- [ ] Supabase dashboard → Authentication → URL Configuration:
  - Site URL: `https://fitcheck-web-lemon.vercel.app` (the web app, so email links sign people straight in)
  - Redirect URLs: add `fitcheck://**` (Android app) and `https://fitcheck-web-lemon.vercel.app/**` (web app)
- [ ] Supabase dashboard → Authentication → Emails → **set up custom SMTP** (e.g. Resend, free tier).
      Supabase's built-in email sender only allows a few emails per hour, which isn't enough for 12+ testers
      confirming their accounts.
- [ ] **Line up at least 12 testers** (friends/family with Android phones and Gmail accounts). New personal
      developer accounts must run a closed test with 12+ testers for 14 days in a row before production.

## 1. Create the app in Play Console

- App name: **Fit Check** (check the Play Store for similar names first; e.g. "Fit Check: AI Closet")
- Default language: English
- App or game: App
- Free or paid: Free
- Package name: `com.fitcheckcloset.app` (set in `mobile/app.json`; it can never change after the first upload)

## 2. Store listing

**Short description (max 80 characters)**

> Digital closet, AI outfit ideas & ratings, and a community to share your fits.

**Full description**

> Fit Check is your closet, your stylist and your fashion community in one app.
>
> BUILD YOUR DIGITAL CLOSET
> Snap the clothes you own. Fit Check fills in the type, colour and style for you, so you always know what's in your wardrobe.
>
> OUTFIT IDEAS FOR ANY OCCASION
> Job interview, date night, wedding, gym, or a cold rainy day: pick the occasion and weather and get outfit ideas made from your own clothes.
>
> GET YOUR FIT RATED
> Post today's outfit and get a 1–5 star rating with what works and specific tips to level it up. Ratings are about the clothes only, never your body.
>
> PRIVATE, ON-DEVICE AI
> On supported phones, the AI runs on your device using Google's Gemini Nano, so your photos aren't sent to an AI company. Other phones use Fit Check's built-in style rules.
>
> SHARE AND GET INSPIRED
> Post your fits, tag friends, like, comment, rate other people's outfits and follow people whose style you love.
>
> SAFE BY DESIGN
> For adults 18+. Report and block tools on every post, comment and profile, with fast moderation.

**Graphics**

- [x] App icon 512 × 512: `design/store/play-store-icon-512.png`
- [x] Feature graphic 1024 × 500: `design/store/feature-graphic-1024x500.png`
- [ ] Phone screenshots: at least 2 (up to 8), e.g. 1080 × 1920. Take them on your phone from the test build
      (closet, Style me ideas, a fit rating, the feed).
- To change the icon or graphics, edit `design/make-assets.js` and re-run it (see the comment at the top).

**Category:** Lifestyle
**Contact details:** retiefbuisness@gmail.com; website: https://fitcheck-legal-two.vercel.app
**Privacy policy URL:** `https://fitcheck-legal-two.vercel.app/privacy.html`

## 3. App content section

### Privacy policy
`https://fitcheck-legal-two.vercel.app/privacy.html`

### App access
"All or some functionality is restricted" → provide a **test account** (email + password) for Google's
reviewers. Create one yourself in the app and note the login here (don't commit it to git).

### Ads
No, the app does not contain ads.

### Content rating (IARC questionnaire)
- Category: **Social / communication** (or "All other app types" if social isn't offered)
- Users can interact / exchange content: **Yes**
- Users can share photos: **Yes**
- Shares user location: **No**
- Allows purchases: **No**
- Violence / sexual content / language / controlled substances / gambling: **No**
Expected result: roughly Teen / PEGI 12 (because of user interaction). Your own **target audience** below is what enforces 18+.

### Target audience and content
- Target age groups: **18 and over only**
- Appeals to children: **No**

### News app
No.

### Data safety
Data is encrypted in transit: **Yes**. Users can request deletion: **Yes** (in-app and `https://fitcheck-legal-two.vercel.app/delete-account.html`).

| Data type | Collected | Shared | Optional? | Purpose |
|---|---|---|---|---|
| Personal info → Email address | Yes | No | Required | Account management |
| Personal info → Name (display name) | Yes | No | Optional | App functionality |
| Personal info → User IDs (username) | Yes | No | Required | App functionality, account management |
| Photos and videos → Photos | Yes | No | Required for posting and closet | App functionality |
| App activity → Other user-generated content (captions, comments, ratings) | Yes | No | Optional | App functionality |
| App activity → Other actions (likes, follows, tags) | Yes | No | Optional | App functionality |
| App info and performance → Diagnostics | Yes (Google ML Kit metrics) | No | Required | Analytics |

Not collected: location, contacts, financial info, health, messages, audio, files, calendar, web history, device IDs.
Date of birth is used only for the age check and is **not stored**, so it doesn't need declaring as collected.
(Service providers like Supabase don't count as "sharing".)

### Government apps / Financial features / Health
No / None / None.

### Account deletion
- In-app: Profile → Settings → Delete account
- Web link: `https://fitcheck-legal-two.vercel.app/delete-account.html`

### Child safety standards (required for social apps)
- Published standards URL: `https://fitcheck-legal-two.vercel.app/child-safety.html`
- In-app reporting: Yes (Report → "Child safety concern")
- Complies with child safety laws and reports CSAM: Yes
- Child safety point of contact: your name and email

### Generative AI
Declare that the app uses AI-generated content (outfit ideas and ratings) and that users can report
offensive AI output in the app (every AI rating has "Report this AI response").

## 4. Build and upload

From `mobile/`:

```
npx eas-cli login
npx eas-cli build --platform android --profile production
```

This produces an `.aab` file (Android App Bundle). In Play Console:

1. Testing → Closed testing → Create track → upload the `.aab`
2. Add your 12+ testers' Gmail addresses to a tester list and send them the opt-in link
3. Keep the test running **14 days in a row** with testers actually using the app
4. Then Production → Apply for production access → answer the questions → roll out

Play App Signing: accept Google's default (Google holds the app signing key; EAS holds your upload key).

## 5. Moderation (after launch)

Reports go to the `reports` table in Supabase (Table Editor). Posts and comments hide themselves automatically
after a child-safety report or 3 reports from different people. To act on one:

- Keep it hidden: set `status` to `actioned` on the report
- Restore it: set `is_hidden` = false on the post/comment and `status` = `dismissed`
- Ban a user: Authentication → Users → delete the user
- For CSAM: don't just delete it. Report to NCMEC (https://report.cybertip.org) or your national authority first.
