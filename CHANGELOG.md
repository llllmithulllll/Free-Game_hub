# Change Log

This document summarizes the accumulated source changes on `codex/gif-avatars-worker-icons` relative to the previous `checkpoint/before-visual-redesign` baseline. It excludes `.env` values. The project owner deployed the GIF Worker; publishing Firebase rules remains a separate Console action.

## App, navigation, and web

- Improved responsive storefront layouts for mobile and desktop, including search/filter alignment, genre shelves, horizontal game cards, view-all filtering, and themed scrollbars.
- Added subtle screen/card/button animations, swipe navigation transitions, reduced-motion handling, and a small animated tilt for the active tab icon.
- Added responsive game details with a game-art backdrop and back navigation.
- Fixed web compatibility issues, including native-only notification APIs running on web and the invalid Expo Router HTML component import.

## Games, library, and giveaways

- Added local game discovery caching, personalized genre ordering, fresh-game rotation, and pull-to-refresh behavior.
- Added giveaway type/section handling for games, DLC/loot, and other offers; platform filters and local notifications; tightened narrow-card claim/share layouts.
- Split claimed offers from claimed DLC in My Games and improved title matching so weak/ambiguous RAWG matches do not open an unrelated game.

## Accounts, profiles, and friends

- Kept preference onboarding after registration/login, collected date of birth, and added age-aware sexual-content filtering.
- Added a dedicated Edit Profile page for account details, age, Discord, and Signal links.
- Added public username profiles, friend search/requests/acceptance, friend game/review views, and profile avatars on friend/search rows.
- Added required animated Tenor GIF profile pictures, editable later from Edit Profile. The GIF picker shows search results, preview/selection state, result counts, and an empty-results message.

## PC compatibility

- Added optional desktop/laptop hardware setup and profile settings for CPU, GPU, RAM, resolution, and preset.
- Added FPSHQ hardware search and per-game estimates, including estimated/measured labels and local caching.

## Appearance and brand

- Added Light/Dark/Auto appearance control and Classic, Xbox, PlayStation, Nintendo, Neon, and RGB accent schemes.
- Updated theme-aware text, cards, alerts, shadows, sliders, backgrounds, and platform marks.
- Added animated loading marks, a colored GamePal logo in Home, and the colored controller-only app icon without a wordmark. Adaptive icon assets include safe-zone padding.

## Backend, privacy, and setup

- Updated `firestore.rules` for age/preferences, libraries and giveaway types, private PC specs, social access, and public Tenor avatar IDs.
- Replaced the proposed Firebase callable GIF function with a Cloudflare Worker so GIF search can run on Firebase Spark without a Blaze upgrade. The Worker validates Firebase ID tokens and stores the Tenor API key as a Cloudflare secret; the app persists only a GIF ID and resolves current media URLs in memory.
- Added setup documentation in `gif-worker/README.md`, `README.md`, and this handoff. `.env` is ignored and no secret values are checked in.

## Files to configure before exercising GIF search

- The project owner deployed the Worker at `https://gamepal-gif-search.thakurmithlesh988.workers.dev`; Wrangler stores secrets encrypted and does not reveal them afterward. See [`gif-worker/README.md`](gif-worker/README.md) to verify bindings and set the app URL.
- Set `EXPO_PUBLIC_GIF_API_URL` in the local root `.env` to that Worker URL, then restart Expo.
- Publish the latest `firestore.rules` file.
- For a new checkout, run `npx expo prebuild --platform android` before Gradle so the source icon settings are copied to generated Android resources.

## Verification status

- No end-to-end app build or test suite was run for this accumulated branch.
- The Worker endpoint is deployed by the project owner. Confirm its `TENOR_API_KEY` and `FIREBASE_PROJECT_ID` secrets with a successful in-app GIF search; secret values cannot be viewed in Wrangler after entry. Firestore rules still need to be published if that has not been done in Firebase Console.
- The installed APK can retain the old launcher icon until rebuilt and reinstalled.
