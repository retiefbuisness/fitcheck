# Fit Check

A social closet app: digital closet, outfit ideas, outfit ratings (on-device Gemini Nano with a free
style-rules fallback), and a feed with likes, comments, star ratings, tags and follows. Adults 18+.

## Folders

| Folder | What it is |
|---|---|
| `mobile/` | The Android app (Expo SDK 57, React Native, Expo Router) |
| `web/` | The web app (Vite + React + TypeScript), hosted on Vercel at https://fitcheck-web-lemon.vercel.app |
| `mobile/modules/fitcheck-ai/` | Native Android module wrapping Gemini Nano (ML Kit GenAI Prompt API) |
| `mobile/src/lib/styleRules.ts` | Free offline style engine (outfit ideas + ratings) |
| `supabase/` | Database schema (already applied) and the `delete-account` function (already deployed) |
| `website/` | Privacy policy, terms, child safety and account deletion pages (must be published) |
| `PLAY_STORE.md` | Step-by-step Google Play Console guide |
| `design/` | Icon and Play Store graphics (`make-assets.js` renders them; outputs in `design/store/`) |
| `Log in to Expo.cmd` | Double-click to log in to Expo so cloud builds can run |

Legal pages are live at https://fitcheck-legal-two.vercel.app (Vercel project `fitcheck-legal`).

## Commands (run inside `mobile/`)

Node.js is installed at `%USERPROFILE%\tools\node-v24.19.0-win-x64`. Add it to PATH first in PowerShell:

```
$env:PATH = "$env:USERPROFILE\tools\node-v24.19.0-win-x64;$env:PATH"
```

| Task | Command |
|---|---|
| Type check | `npx tsc --noEmit` |
| Lint | `npx expo lint` |
| Health check | `npx expo-doctor` |
| Log in to Expo | `npx eas-cli@latest login` |
| Test APK for your phone | `npx eas-cli@latest build --platform android --profile preview` |
| Play Store build (.aab) | `npx eas-cli@latest build --platform android --profile production` |

The app uses custom native code, so it will **not** run in Expo Go. Install the preview APK on your phone.
If EAS complains that git is missing, either install Git or set `$env:EAS_NO_VCS = "1"` first.

## Web app (`web/`)

Same features and same Supabase backend as the Android app, so accounts, closets and posts are shared.
AI runs on-device through Chrome's built-in Prompt API (desktop Chrome on capable PCs); every other browser
uses the free style rules. `src/shared/` is a copy of the mobile style engine: change both together.

| Task | Command (inside `web/`) |
|---|---|
| Run locally | `npm run dev` |
| Type check + build | `npm run build` |
| Lint | `npm run lint` |
| Deploy to Vercel yourself | `npx vercel login` once, then `npx vercel --prod` |

Vercel project: `fitcheck-web` (build `npm run build`, output `dist`). `vercel.json` sends every URL to the
app so links like `/post/123` work when opened directly.

## Testing the AI

Gemini Nano only runs on supported phones (e.g. Pixel 8 and newer, Galaxy S24 and newer). On other phones the
app shows a notice and uses the style rules instead. Test both.
