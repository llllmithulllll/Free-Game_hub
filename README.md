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
- Sign in with email/password or Google. Email signup shows and enforces an 8-character minimum with at least one letter and one number. Google accounts complete the same username, date-of-birth, and game-preference onboarding.
- Search players by username, send/accept friend requests, view accepted friends’ profiles and libraries, and open external Discord/Signal contact links.
- Optionally upload a profile photo or animated GIF from the device/browser. Files are validated and uploaded through a Firebase-authenticated Cloudflare Worker to R2, then shown on profiles and friend/search lists. No external GIF search or Tenor API key is used.
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
| User-uploaded avatars | Cloudflare Worker + R2 object storage |
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
  edit-profile.tsx            Profile editing and optional photo/GIF upload
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
  profile-avatars.ts           Authenticated upload/delete calls to the avatar Worker
  social.ts                    Stable friendship document ID helper
firestore.rules                Firestore security and data validation rules
gif-worker/src/index.js        Avatar Worker; verifies Firebase ID tokens and uses R2
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
EXPO_PUBLIC_AVATAR_API_URL=https://gamepal-gif-search.thakurmithlesh988.workers.dev
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

Use the Firebase web app configuration and a RAWG API key. Expo embeds `EXPO_PUBLIC_*` values into builds, so treat distributable APKs as containing those client configuration values. Do not put server credentials or private admin keys in this file.

### Google sign-in setup

1. In Firebase Console, open **Authentication → Sign-in method** and enable **Google**.
2. In Google Cloud Console, use the OAuth credentials associated with the same Firebase project. Add a **Web application** OAuth client and put its client ID in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
3. Create an **Android** OAuth client for package `com.llllmithulllll.freegamehub`. Register the SHA-1 fingerprint of the signing key used to build the app, then put that client ID in `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`. For the current local debug build, Android Studio's debug key can be inspected with:

   ```powershell
   keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

   For a release APK, register the release signing key's SHA-1 too. Never share or commit a keystore or its passwords.
4. If you distribute an iOS app, create an **iOS** OAuth client for bundle ID `com.llllmithulllll.freegamehub` and set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
5. In Firebase Authentication's **Authorized domains**, add the domain that serves the web app.
6. Put the client IDs in your private local `.env`. Client IDs are public app configuration; never put a client secret in the Expo app.
7. Restart Expo after changing `.env`. Rebuild and reinstall the Android app to apply the native auth configuration; a Metro reload alone does not update an installed APK.

Google sign-in uses Firebase Auth on web and the Expo browser ID-token flow on Android. Google accounts are asked for an in-app username and date of birth before game-preference setup when those fields do not already exist.

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
| `publicProfiles/{uid}` | Searchable display name/username and optional uploaded avatar URL/key, without email or date of birth |
| `friendships/{pairId}` | Pending/accepted relationships |
| `global_games/{gameId}` | Shared catalog cache |
| `games/{gameId}/reviews/{reviewId}` | Game reviews |

Existing accounts become discoverable after they open Friends in the updated app once, which creates/backfills their public profile. Friend search queries `publicProfiles`; it does not enumerate Firebase Auth users.

After changing `firestore.rules`, paste the entire file into **Firebase Console → Firestore Database → Rules** and click **Publish**, or deploy with Firebase CLI after configuring the project. A local rules edit does not update the live database.

Profile photos/GIFs are optional. Uploads use a Cloudflare Worker backed by R2 because Firebase Storage requires Blaze for new buckets. Follow [gif-worker/README.md](gif-worker/README.md) to activate R2, create the bucket, deploy the Worker, and set `EXPO_PUBLIC_AVATAR_API_URL`. R2 currently includes monthly free usage, but enabling it requires subscription/billing activation and usage above the free allowance is billed. No Tenor API key or GIF-search service is needed. The Worker verifies Firebase ID tokens for uploads and deletes, validates file types and size, and serves selected avatar files through the same Worker URL.

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
