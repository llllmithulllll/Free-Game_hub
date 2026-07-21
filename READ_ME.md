# Free-Game Hub

A React Native (Expo) app for discovering games, tracking your personal game library, and catching free game giveaways before they expire — with push notifications when a new one drops.

## Features

- **Auth** — email/password sign-up and login via Firebase Auth, with a required email-verification step before login is allowed.
- **Onboarding preferences** — new users pick favorite categories (Action, Shooter, MMORPG, Racing, Sports, Strategy) right after verifying their email.
- **Home** — browse and search a large game catalog (powered by RAWG), filter by category, quick-add games to *Playing* or *Completed* straight from the grid.
- **Giveaways** — live feed of free game/DLC giveaways (powered by GamerPower), filterable by platform and type, with one-tap claim tracking and sharing.
- **Push notifications** — get notified the moment a new giveaway appears, even with the app closed. Tapping the notification opens the Giveaways tab directly.
- **Game details** — screenshots, PC requirements, community rating breakdown, an in-app review thread, and linked Reddit discussions for each game.
- **Profile** — your library organized into collapsible sections (Claimed, Playing, Completed, Backlog), with inline status changes and removal.

## Tech stack

| Layer | Choice |
|---|---|
| App framework | Expo + Expo Router (file-based routing) |
| Language | TypeScript / React Native |
| Auth & database | Firebase Auth + Cloud Firestore |
| Local cache | `@react-native-async-storage/async-storage` |
| Game catalog & details | [RAWG API](https://rawg.io/apidocs) |
| Free game giveaways | [GamerPower API](https://www.gamerpower.com/api-read) |
| Push notifications | `expo-notifications` (client) + a standalone Node script (server side — see below) |

## Project structure

```
app/
  _layout.tsx              Root layout — auth gate, routing, push token registration,
                            notification-tap handling
  login.tsx                 Login screen
  signup.tsx                 Sign-up screen (sends email verification)
  preferences.tsx            Post-signup category picker
  (tabs)/
    _layout.tsx               Bottom tab navigator (Home, Giveaways, Profile)
    index.tsx                  Home — browse/search catalog
    free_now.tsx                Giveaways — free games feed
    profile.tsx                 User's game library
    details.tsx                  Game detail screen (hidden tab, opened via navigation)

lib/
  firebase.ts                Firebase app/auth/Firestore init
  notifications.ts            Push notification permission + token registration

scripts/
  check-giveaways.js          Standalone script: polls GamerPower, sends push
                              notifications for anything new (see "Push notifications"
                              below for why this isn't a Firebase Cloud Function)
  package.json

.github/workflows/
  check-giveaways.yml         Optional: runs the script above on a schedule via
                              GitHub Actions, if you don't want to host it yourself

firestore.rules               Security rules for all collections used by the app
```

## Firestore data model

| Collection | Purpose | Written by |
|---|---|---|
| `users/{uid}` | Profile doc (display name, email, createdAt) | Client (signup) |
| `users/{uid}/preferences/data` | Selected categories | Client (preferences screen) |
| `users/{uid}/gameStatus/{gameId}` | Per-user library entries (status, thumbnail, etc.) | Client |
| `global_games/{gameId}` | Shared cache of games seen across all users, powering fast search | Client (batched writes) |
| `games/{gameId}/reviews/{reviewId}` | In-app user reviews | Client |
| `pushTokens/{token}` | Registered Expo push tokens, keyed by token | Client |
| `meta/seenGiveaways` | Bookkeeping — giveaway IDs already notified about | Notification script only (Admin SDK) |

## Setup

### 1. Environment variables

Create a `.env` in the project root:

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
EXPO_PUBLIC_RAWG_API_KEY=
```

Values come from Firebase Console (Project Settings → your web app config) and [rawg.io/apidocs](https://rawg.io/apidocs) (free API key signup).

### 2. Firebase project

- Create a Firebase project, enable **Authentication → Email/Password**, and enable **Cloud Firestore**.
- Paste the contents of `firestore.rules` into Firestore → Rules and publish. Every collection the app touches is scoped to the signed-in user except `global_games` (shared, any signed-in user can write) and public read-only reviews.
- No Blaze (pay-as-you-go) plan is required for the app itself — everything here runs on Firestore's free Spark tier.

### 3. Install and run

```
npm install
npx expo start
```

Use a **development build**, not Expo Go, if you want to test push notifications — Expo Go no longer supports remote push on Android. Build one locally:

```
npx expo prebuild
cd android
gradlew assembleDebug
```

or via EAS:

```
eas build --profile development --platform android
```

### 4. Push notifications setup

Push notifications need two pieces beyond the app itself:

**Client (already wired up):** `lib/notifications.ts` requests permission and registers an Expo push token on login, saved to `pushTokens/{token}` in Firestore. Requires an EAS project link for the token to be issued:
```
npm install -g eas-cli
eas init
```

**Server side — deliberately *not* a Firebase Cloud Function.** Scheduled Cloud Functions require the Blaze plan; to avoid that requirement entirely, the periodic "check for new giveaways and notify" job is a plain Node script (`scripts/check-giveaways.js`) that talks to Firestore via a service account key and to Expo's push API directly. Run it on any schedule you like:

- **GitHub Actions** — `.github/workflows/check-giveaways.yml` runs it every 30 minutes for free. Add your Firebase service account JSON (Firebase Console → Project Settings → Service Accounts → Generate new private key) as a repo secret named `FIREBASE_SERVICE_ACCOUNT_KEY`.
- **Your own server** — copy the `scripts/` folder over, `npm install`, and add a cron entry running it every 30 minutes with the same service account key available as an environment variable.

Either way, nothing here touches Firebase Cloud Functions or requires billing to be enabled.

## Known limitations

- Firestore offline persistence is **not** enabled — the JS SDK's persistence APIs are web-only (they depend on IndexedDB), so this app runs online-only. Real offline support would require switching to `@react-native-firebase/firestore`.
- Home's search checks the shared `global_games` cache first, then falls back to RAWG's live search API for anything not yet cached — so very new or low-rated titles may take a moment to appear the first time anyone searches for them, after which they're cached for everyone.
- Push notifications only work on physical devices, not emulators/simulators.
