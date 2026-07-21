# Free-Game Hub

A React Native (Expo) app for discovering games, tracking your personal game library, and catching free game giveaways before they expire.

## Features

- **Auth** — email/password sign-up and login via Firebase Auth, with a required email-verification step before login is allowed.
- **Onboarding preferences** — new users pick favorite categories (Action, Shooter, MMORPG, Racing, Sports, Strategy) right after verifying their email.
- **Home** — browse and search a large game catalog (powered by RAWG), filter by category, quick-add games to *Playing* or *Completed* straight from the grid.
- **Giveaways** — live feed of free game/DLC giveaways (powered by GamerPower), filterable by platform and type, with one-tap claim tracking and sharing.
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

## Project structure

```
app/
  _layout.tsx              Root layout — auth gate and routing
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

To build a standalone APK instead of using Expo Go:

```
npx expo prebuild
cd android
gradlew assembleDebug
```

or via EAS:

```
eas build --profile development --platform android
```

## Known limitations

- Firestore offline persistence is **not** enabled — the JS SDK's persistence APIs are web-only (they depend on IndexedDB), so this app runs online-only. Real offline support would require switching to `@react-native-firebase/firestore`.
- Home's search checks the shared `global_games` cache first, then falls back to RAWG's live search API for anything not yet cached — so very new or low-rated titles may take a moment to appear the first time anyone searches for them, after which they're cached for everyone.
