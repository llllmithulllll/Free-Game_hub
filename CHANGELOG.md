# Change Log

This document summarizes the accumulated source changes on `codex/gif-avatars-worker-icons` relative to the previous `checkpoint/before-visual-redesign` baseline. It excludes `.env` values. The owner previously deployed the Tenor Worker; the current source replaces it with optional user uploads and must be redeployed with an R2 bucket.

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
- Replaced Tenor GIF search with optional photo/GIF upload from device or browser. Users can change/remove their avatar; choosing a profile picture is no longer required to access the app or save profile details.

## PC compatibility

- Added optional desktop/laptop hardware setup and profile settings for CPU, GPU, RAM, resolution, and preset.
- Added FPSHQ hardware search and per-game estimates, including estimated/measured labels and local caching.

## Appearance and brand

- Added Light/Dark/Auto appearance control and Classic, Xbox, PlayStation, Nintendo, Neon, and RGB accent schemes.
- Updated theme-aware text, cards, alerts, shadows, sliders, backgrounds, and platform marks.
- Added animated loading marks, a colored GamePal logo in Home, and the colored controller-only app icon without a wordmark. Adaptive icon assets include safe-zone padding.

## Backend, privacy, and setup

- Updated `firestore.rules` for age/preferences, libraries and giveaway types, private PC specs, social access, and optional uploaded avatar URLs/keys.
- Replaced Tenor search with an authenticated Cloudflare Worker upload/delete API backed by R2. The Worker validates Firebase ID tokens, checks image signatures and a 5 MB limit, and stores public avatar objects. No Tenor key is required.
- Added setup documentation in `gif-worker/README.md`, `README.md`, and this handoff. `.env` is ignored and no secret values are checked in.

## Files/services to configure before exercising avatar uploads

- Create the `gamepal-avatars` Cloudflare R2 bucket, then redeploy the updated Worker using [`gif-worker/README.md`](gif-worker/README.md). The deployed Worker URL stays `https://gamepal-gif-search.thakurmithlesh988.workers.dev`.
- Set `EXPO_PUBLIC_AVATAR_API_URL` in the local root `.env` to that Worker URL, then restart Expo. Do not share `.env` contents.
- Publish the updated `firestore.rules` file.
- For a new checkout, run `npx expo prebuild --platform android` before Gradle so the source icon settings are copied to generated Android resources.

## Verification status

- No end-to-end app build or test suite was run for this accumulated branch.
- The source Worker now requires an R2 bucket binding and only a `FIREBASE_PROJECT_ID` secret. The old Tenor deployment must be replaced by deploying this source. Firebase rules still need to be published if that has not been done in Firebase Console.
- The installed APK can retain the old launcher icon until rebuilt and reinstalled.
