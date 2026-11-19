# GamePal

GamePal is a cross-platform game discovery and social library app built with Expo, React Native, TypeScript, and Expo Router. It runs on Android and as a responsive website. The web storefront uses a desktop game-store layout inspired by large PC game stores.

For the project’s current status, implementation decisions, known issues, and handoff notes, read [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) before changing code.
For a categorized list of changes on this branch, see [CHANGELOG.md](CHANGELOG.md).

## Features

- Discover and search games from the RAWG catalog, with genre/platform filters, personalized ordering, featured artwork, and horizontal genre shelves on the web storefront.
- Claimed-offer title lookup rejects weak or ambiguous RAWG matches rather than opening an unrelated game page.
- Optional PC setup after game preferences, with a Profile settings entry to manage CPU/GPU/RAM, estimate FPS, and filter game search matches by FPS threshold.
- Appearance is a settings submenu: switch Light/Dark/Auto, choose Classic, Xbox, PlayStation, Nintendo, Neon, or animated RGB colors, and see matching animated platform/game marks in the Home tab and app backgrounds.
- Browse free game, DLC/loot, and other offers from GamerPower; claim offers to the personal library, open the giveaway, and share it.
- Maintain a library of games marked Playing, To Play, Completed, or Claimed. Claimed DLC has its own library filter. Tapping a claimed offer searches RAWG by title and opens the catalog detail page.
- Create an account with date of birth, choose onboarding preferences after login, and apply the age-aware sexual-content filter.
- Search players by username, send/accept friend requests, view accepted friends’ profiles and libraries, and open external Discord/Signal contact links.
- Select a required animated Tenor GIF avatar during first profile setup; avatars are shown on profiles and in friend/search lists. Search runs through a free Cloudflare Worker that verifies Firebase sign-in tokens and keeps the Tenor API key server-side.
- Enable local notifications for friend requests and platform-filtered new giveaways. These checks currently run while the app is active.
- Browse on mobile and desktop layouts. The web storefront includes subtle entry/hover/press animations and honors `prefers-reduced-motion`.
- Use the colored controller-only GamePal icon, without a wordmark, as the app mark; the selected navigation icon tilts slightly when its page is active.

## Stack and data sources

| Area | Technology |
|---|---|
| App and web | Expo SDK 54, React Native 0.81, React Native Web |
| Routing | Expo Router 6 (file-based) |
| Language | TypeScript |
| Authentication and database | Firebase Auth, Cloud Firestore |
| GIF avatar search | Tenor API through Firebase-authenticated Cloudflare Worker |
| Local preference/cache storage | AsyncStorage |
| Game catalog and detail data | RAWG API |
| Free offers | GamerPower API |
| PC FPS compatibility data | FPSHQ API |
| Motion | React Native Reanimated and web CSS |

## Important routes and files

```text
app/
  _layout.tsx                 Root auth/onboarding gate, theme provider, route stack
  +html.tsx                   Web document template and scrollbar/motion CSS
  login.tsx, signup.tsx       Authentication screens
  preferences.tsx             Post-login preference onboarding
  pc-compatibility.tsx        Private hardware profile and FPS lookup
  details.tsx                 RAWG game detail page
  edit-profile.tsx            Profile editing and required Tenor GIF avatar selection
  friend-profile.tsx           Accepted friend profile/library
  my-games.tsx                 Personal game library and status filters
  (tabs)/
    _layout.tsx               Home/Giveaways/Friends/Profile navigation
    index.tsx                  Home catalog, search, filters, storefront shelves
    free_now.tsx               GamerPower giveaways, claim/share and alerts
    friends.tsx                Public-profile search and friend relationships
    profile.tsx                User profile, settings, appearance control
lib/
  firebase.ts                  Firebase initialization
  theme.tsx                    Theme context and themed alerts/styles
  local-notifications.ts       Local notification helpers/settings
  game-catalog.ts              RAWG title lookup used for claimed offers
  pc-performance.ts            FPSHQ API calls and one-hour local cache
  social.ts                    Stable friendship document ID helper
firestore.rules                Firestore security and data validation rules
gif-worker/src/index.js        Free Worker proxy; verifies Firebase ID tokens
firebase.json                 Maps Firestore deployment to firestore.rules
```

The icon source is configured in `app.json`; adaptive foreground assets live in `assets/gamepal/`. When regenerating native Android files on another checkout, run `npx expo prebuild --platform android` before the Gradle build so the updated icon is copied into Android resources. The Android resources in this workspace are generated locally and are excluded from Git.

## Local setup

### Environment variables

Create a root `.env` file. Never paste its values into chats, handoff documents, or source control. The required variable names are:

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
EXPO_PUBLIC_RAWG_API_KEY=
EXPO_PUBLIC_GIF_API_URL=
```

Use the Firebase web app configuration and a RAWG API key. Expo embeds `EXPO_PUBLIC_*` values into builds, so treat distributable APKs as containing those client configuration values. Do not put server credentials or private admin keys in this file.

### Install dependencies and run

From the project root:

```powershell
npm install
npm run web
```

Expo prints the local URL (typically `http://localhost:8081`). To run the app through Metro for Android development, use `npx expo start` and connect an Android development build or Expo Go as appropriate.

## Android APK

For a standalone release APK, from the project root (after Android native files have been generated):

```powershell
cd android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

The expected output is:

```text
android\app\build\outputs\apk\release\app-release.apk
```

Use Java 17 for this project’s Gradle build. The Android Studio bundled Java 25 produced a Kotlin/Gradle error (`IllegalArgumentException: 25.0.4`); Java 8 is too old. The user has Java 17 installed and has set it in their environment. The arm64-only override avoids building unused ABIs and targets most current Android phones. A build must end with `BUILD SUCCESSFUL`; an existing APK in the output folder may be stale if the build failed.

## Firebase setup and data model

Enable Firebase Authentication Email/Password and create a Cloud Firestore database. Firestore rules are maintained in `firestore.rules`; `firebase.json` points at that file. Publishing is a separate Firebase Console/deployment action and is not performed by editing the local file.

Collections used by the app:

| Path | Purpose |
|---|---|
| `users/{uid}` | Private user profile and date of birth |
| `users/{uid}/preferences/data` | Selected categories and sexual-content preference |
| `users/{uid}/gameStatus/{gameId}` | Personal game library; giveaway claims include `giveawayType` |
| `users/{uid}/socialLinks/links` | Private Discord/Signal contact information |
| `users/{uid}/pcProfile/specs` | Private PC hardware profile (CPU/GPU/RAM and forecast settings) |
| `publicProfiles/{uid}` | Searchable display name/username and selected Tenor GIF ID, without email or date of birth |
| `friendships/{pairId}` | Pending/accepted relationships |
| `global_games/{gameId}` | Shared catalog cache |
| `games/{gameId}/reviews/{reviewId}` | Game reviews |

Existing accounts become discoverable after they open Friends in the updated app once, which creates/backfills their public profile. Friend search queries `publicProfiles`; it does not enumerate Firebase Auth users.

After changing `firestore.rules`, paste the entire file into **Firebase Console → Firestore Database → Rules** and click **Publish**, or deploy with Firebase CLI after configuring the project. A local rules edit does not update the live database.

GIF avatar search uses a Cloudflare Worker so it works with Firebase Spark and does not require Firebase Blaze. Follow [gif-worker/README.md](gif-worker/README.md) to deploy it. Never put the Tenor API key in the Expo `.env`. The Worker verifies Firebase ID tokens and uses Tenor's high content filter; the app stores only the selected GIF ID and resolves current URLs in memory for less than 24 hours.

## Known limitations

- Firestore persistence is in-memory on native; true offline support would require a different native Firestore integration.
- Giveaway and friend-request notifications are local checks while the app is active. Background/closed-app alerts need a trusted scheduled backend and remote push delivery.
- The RAWG API key is required for catalog discovery, detail pages, and claimed-offer lookup.
- FPS lookup can filter up to eight matches from a game search by 30/45/60 FPS; catalog-wide compatibility filtering and extra hardware parameters (such as laptop power limits/VRAM) remain future work. FPSHQ documents game/GPU/CPU forecasts, hardware search, measured-versus-predicted labels, and commercial use with attribution. Fair-use guidance is about 60 requests/minute per IP; the app caches local lookup results for one hour. See [FPSHQ API docs](https://fpshq.com/en/api-docs/).
- FPS projections are estimates, not promises: resolution, preset, drivers, thermals, RAM, laptop power limits, game patches, and individual scenes affect actual results. The app should clearly display estimate versus measured data and confidence/ranges where returned.
- A React Native phone app cannot inspect a user’s Windows PC hardware. Users enter their profile manually; a future desktop detector would need a separately reviewed, signed desktop companion and explicit consent.
- Firestore rules were extended for the private `pcProfile/specs` document. Publish the updated local `firestore.rules` in Firebase Console before testing saves. FPSHQ requires no API key or `.env` value.
- Friend search only sees public profiles that have been created. Older accounts need to launch the updated app and visit Friends once.
- `firestore.rules` must be published in the Firebase project. This workspace cannot publish remote Firebase configuration.
