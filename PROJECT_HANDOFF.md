# GamePal — Project Handoff

**Last updated:** 2026-11-19  
**Workspace:** `E:\project\app`  
**Current branch:** `codex/gif-avatars-worker-icons`  
**Audience:** A future AI assistant or developer continuing this project

Read this document and `README.md` before editing. This file records the product context, recent implementation work, known failures, and what still needs verification. It intentionally excludes `.env` contents and all API/Firebase values.

## 1. Product goal

GamePal is a React Native + Expo game discovery and social library app that must work on Android phones and as a responsive website. The web storefront is intended to feel like a PC game store: prominent game artwork, category shelves, filters, and desktop-friendly navigation. The long-term goal expressed by the owner is a production-scale product.

Core product areas:

- Discover and search games through RAWG.
- Browse free game, DLC/loot, and other offers from GamerPower; track claimed offers.
- Maintain a personal library and open details for games.
- Register/login with age-aware onboarding and preferences.
- Find players, add friends, and view accepted friends’ games/reviews.
- Expose optional Discord and Signal details to accepted friends, with communication handled externally.
- Provide light/dark/automatic appearance and a responsive web layout.

## 2. Changes included in the current feature branch

- Responsive Expo app/site: desktop storefront layout, game search and filtering, featured/catalog shelves, themed scrollbar, page/card transitions, swipe navigation, and reduced-motion support.
- Account onboarding: date of birth, preference setup after login, age-aware sexual-content filtering, and profile editing.
- Game library: statuses, claimed offers separate from DLC, claimed-offer RAWG title matching, and Home refresh/discovery ordering.
- Giveaways: offer categories, platform filters, claim/share actions, and local notification settings.
- Friends: username search, requests/acceptance, public friend profiles, game/review visibility, and Discord/Signal contact links.
- PC compatibility: manual desktop/laptop CPU, GPU, and RAM profile; FPSHQ search/forecasts; profile settings and onboarding entry.
- Appearance: light/dark/auto, Classic/Xbox/PlayStation/Nintendo/Neon/RGB palettes, themed cards/alerts, animated background marks, and active-tab icon tilt.
- Brand assets: animated loading marks, colored GamePal wordmark in the Home header, and a colored controller-only app icon without the wordmark. `app.json` references the correct assets; Android generated launcher files are local/ignored and should be regenerated with Expo prebuild on another checkout.
- Optional profile picture upload: users may choose a photo or animated GIF, change it later, remove it, or skip it entirely. A Firebase-authenticated Cloudflare Worker stores files in R2 and serves them to profiles/friends; Tenor is no longer used.
- Firestore rules for private PC specs, library giveaway types, optional avatar URLs/keys, and social access are maintained in `firestore.rules`.

This branch contains source-level implementation. The owner previously deployed the Tenor version of the Worker; the current source needs an R2 bucket and redeploy. No complete Android release build or Firebase Console rules publish was completed by the assistant.

## 3. Current repository and secrets

This feature branch is based on the earlier checkpoint `checkpoint/before-visual-redesign` and includes the subsequent implementation work. Do not run `git reset` or discard changes without checking with the owner. `/android` is git-ignored native output; app configuration and icon source assets are tracked instead.

The local root `.env` exists. Do not open it, print it, copy values into documentation, or commit it. `.env.example` contains blank placeholders.

## 4. Implemented features and decisions

### Authentication and age/preferences

- Signup collects date of birth; preference onboarding is intended to occur after login, not flash during registration.
- Under-18 users get sexual-content titles filtered. Adults can control the filter in Profile.
- New accounts choose game categories/preferences.
- Root navigation/auth routing is in `app/_layout.tsx`.

### Recommendation/discovery

- Home uses RAWG for the catalog and a Firestore `global_games` cache, with local AsyncStorage cache and pagination/search.
- Preference categories and locally stored discovery impressions affect ordering; the user asked for repetition to decrease and favored genres to be shown more often as interest signals accumulate.
- Pull-to-refresh and fresh game rotation were requested and implemented in Home.
- The web Home storefront has a featured title, genre shelves with horizontal scrolling, view-all filtering, search, and a desktop filter sidebar. The user previously reported empty shelves/alignment issues; code has been revised, but must be checked in the running browser because this was not visually verified in this session.

### Giveaways and My Games (latest implementation)

- `app/(tabs)/free_now.tsx` loads GamerPower offers, has Games/DLC & Loot/Other offer sections, claim tracking, open/share actions, platform/type filters, and local alerts.
- Latest change: giveaway action buttons wrap on narrow layouts, the card content has `minWidth: 0`, and Share has a compact fixed size to stop it escaping the card on the owner’s Realme Narzo 50 Pro.
- A claimed giveaway now stores a `giveawayType` field (`game`, `loot`, `beta`, or `other`).
- `app/my-games.tsx` adds separate **Claimed Offers** (non-DLC claims) and **Claimed DLC** filters alongside **All**. Older claims without `giveawayType` use title-based detection as a fallback.
- Tapping a claimed offer queries the same RAWG API used by Home via `lib/game-catalog.ts`, then navigates to `/details` with the RAWG game ID. Successful lookup IDs are cached while My Games remains mounted.
- Follow-up fix: RAWG lookup removes known platform suffixes (for example, `(PC)` or `(Steam)`) before sending the query, then scores title similarity, accepts exact names, and rejects low-confidence or close-tie candidates. My Games explains when no safe match is found and lets the user search Home. This prevents wrong detail pages; it does not make RAWG aliases/releases exhaustive.
- **Firestore dependency:** `validLibraryEntry()` in `firestore.rules` must allow `giveawayType`; until the updated rules are published, new claim writes may be rejected.

### PC compatibility and FPS

- After first-time preference setup, users see an optional PC details screen with a **Later** option. Users can also open **Profile → PC compatibility** at any time.
- `app/pc-compatibility.tsx` lets the user search and choose a GPU and CPU from FPSHQ, enter RAM, choose target resolution and preset, save the configuration, and search a game to estimate its FPS.
- `lib/pc-performance.ts` calls FPSHQ’s public API directly (no API key or `.env` setting), caches searches/estimates locally for one hour, applies timeouts, and handles rate limits/provider errors. FPSHQ says responses are also cached for an hour and fair-use is about 60 requests/minute/IP. Keep the one-at-a-time game lookup bounded; a catalog-wide FPS filter is not implemented.
- Results explicitly label measured benchmarks versus modeled estimates, show FPS range/1% low when returned, and link the provider page. Forecasts are not guaranteed because laptop power limits, thermals, drivers, patches, settings and game scenes vary.
- PC data is stored at `users/{uid}/pcProfile/specs`, readable only by its owner in the local rules. `firestore.rules` has a validation block for the fixed `specs` doc. The user must publish the updated full rules file in Firebase Console before saving will work; this has not been published remotely by the assistant.
- Feature follow-up for production: catalog-wide filtering is not implemented. Avoid bulk fetching forecasts on each Home load; build a bounded/cached batch or negotiate higher capacity/service terms before expanding. A web/mobile app cannot inspect a Windows PC; current hardware entry is manual.

### Friends

- `app/(tabs)/friends.tsx` searches the signed-in user’s `publicProfiles` collection by `usernameLower`; it does not enumerate Firebase Auth accounts.
- Legacy accounts are backfilled when each account opens Friends in the updated app. Therefore, an old account may not appear until that person launches the updated app and visits Friends once.
- The current UI now explains this when search returns no result. Friends/read/write rules are in `firestore.rules`.
- The owner has not yet confirmed trying this updated behavior with existing accounts.

### Appearance, details, web and animation

- `lib/theme.tsx` owns Light/Dark/System mode, themed alerts, color mapping, and card shadows. The bulb appearance control is in Profile, with icon states requested by the owner.
- `app/+html.tsx` is the web document template. It must use standard HTML elements and Expo Router’s exported `ScrollViewStyleReset`; the installed Expo Router package did not export the `Html` component previously used. The unsupported `Html` import caused “Element type is invalid” and has been removed.
- The template adds a themed scrollbar, subtle web page/card/button motion, and a global `prefers-reduced-motion` override.
- `lib/theme.tsx` supports persisted Classic/Xbox/PlayStation/Nintendo/Neon/RGB accent schemes alongside Light/Dark/Auto. RGB cycles accent hues; low-opacity Xbox/PlayStation logos float behind Home, Giveaways, Friends, Profile, and PC compatibility. The background animation checks reduced-motion preference.
- `app/(tabs)/index.tsx` applies web motion classes and existing Reanimated card entrances.
- `app/(tabs)/_layout.tsx` adapts tabs for narrow/mobile versus wide/desktop web.
- Game details use the game art as a blurred backdrop, preserve a back action, and size hero content responsively.
- `expo-notifications` last-response/listener APIs are native-only; `app/_layout.tsx` guards them on web to prevent the reported web runtime exception.

## 5. Routes and architecture

Expo Router’s main entry is `expo-router/entry` (see `package.json`). Important files:

| File | Responsibility |
|---|---|
| `app/_layout.tsx` | Theme/auth/onboarding gate and root stack |
| `app/(tabs)/_layout.tsx` | Home, Giveaways, Friends, Profile tabs |
| `app/(tabs)/index.tsx` | RAWG home/discovery/storefront |
| `app/(tabs)/free_now.tsx` | GamerPower giveaways |
| `app/(tabs)/friends.tsx` | Player search and relationships |
| `app/(tabs)/profile.tsx` | Profile/settings/appearance entry |
| `app/my-games.tsx` | Personal game library |
| `app/details.tsx` | RAWG details/reviews/screenshots |
| `app/edit-profile.tsx` | Profile editing |
| `app/friend-profile.tsx` | Friend profile and library |
| `app/preferences.tsx` | Game preference onboarding |
| `lib/firebase.ts` | Firebase config and native/web SDK initialization |
| `lib/theme.tsx` | Theme state and themed alert UI |
| `lib/local-notifications.ts` | Notification permissions/settings/delivery |
| `lib/game-catalog.ts` | RAWG search for claimed offer titles |
| `lib/social.ts` | Stable relationship document ID |
| `lib/profile-avatars.ts` | Authenticated local image/GIF upload and owned-file deletion through the Worker |
| `gif-worker/src/index.js` | Firebase ID-token validation, image signature/size checks, R2 upload/delete, and public avatar reads |
| `components/ProfileAvatar.tsx` | Optional uploaded avatar display, with a fallback icon |
| `firestore.rules` | Full rules source |
| `firebase.json` | Points Firestore deployment to `firestore.rules` |

Environment variable names are documented in `README.md`; actual values are private and must remain in `.env`.

## 6. Firestore rules issue — current state

The rules file is plain Firestore Rules source beginning with `rules_version = '2';`. It must be pasted as the **entire file**, without Markdown fences or surrounding explanation, if using the Console. The local source is `firestore.rules`.

Recent Console errors (historical):

1. An earlier line-96/EOF parser error was in `validPreferences()` around the optional `sexualContentFilter` expression.
2. A subsequent full paste had one extra closing parenthesis at line 98 and a cascading `Unexpected '}'` around line 256.
The current rules include `giveawayType` validation for library entries, CPU/GPU profile validation, social/friendship access, and optional avatar URL/key validation. New avatars use `avatarProvider: 'upload'`; the URL is hosted by the upload Worker and the random storage key is scoped to the owner. Users may omit the avatar fields entirely.

The line-96/EOF and line-98 errors were from previous pasted versions; the current local `firestore.rules` was rewritten with explicitly grouped avatar checks. The Firebase CLI is not installed here, so the rules have not been compiled with the Firebase Rules parser. The owner must publish the latest whole `firestore.rules` file in Firebase Console (or deploy with Firebase CLI) before testing saves. Do not replace these rules with open `allow read, write` rules.

## 7. Android build status and prior errors

The owner wants to install the current app APK on a real Android phone. The only safe success indicator is `BUILD SUCCESSFUL` with a newly written APK; an existing output APK can be stale.

After pulling the branch, regenerate native assets/config from `app.json` with `npx expo prebuild --platform android` (do not use `--clean` unless intentionally recreating native files). Then from `android` (owner says Java 17 has already been configured in environment variables):

```powershell
cd android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Expected output:

```text
E:\project\app\android\app\build\outputs\apk\release\app-release.apk
```

History:

- Java 8 originally failed because React/Expo Gradle plugins require Java 11+.
- Android Studio bundled JBR reported Java `25.0.4`, which this project’s Kotlin Gradle plugin could not parse (`IllegalArgumentException: 25.0.4`). Java 17 exists at `C:\Program Files\Java\jdk-17` and got Gradle configuration moving.
- A user-reported release build failed at `:app:configureCMakeRelWithDebInfo[armeabi-v7a] FAILED`; they had not included the detailed CMake error. The suggestion was to build only `arm64-v8a`. The owner then asked for the command without JAVA_HOME setup and was given the command above.
- An assistant-side release build with Java 17 made it through bundling the latest JS and long native builds but was interrupted by the user before success. Do not claim that it produced a fresh APK. The old `app-release.apk` may still be present.
- If the same ABI failure persists despite the override, ask for the full CMake error lines immediately preceding the `FAILED` task. `armeabi-v7a` should not be configured when the CLI property is correctly applied.

Debug APKs may require Metro; use a successful release APK to launch independently on the phone.

## 8. Known reported errors and fixes

- **Web white screen / Expo Notifications API unavailable:** notification response APIs are guarded by `Platform.OS !== 'web'` in root layout.
- **Web “Element type is invalid” from undefined `Html`:** `app/+html.tsx` now uses intrinsic `<html>/<head>/<body>` and exported `ScrollViewStyleReset`.
- **Game catalog slow / giveaways spinner:** prior work added caching, request handling, and errors, but performance should still be verified on the actual phone/network.
- **Claimed offer opens an unrelated game:** `lib/game-catalog.ts` now rejects weak/ambiguous matches instead of defaulting to the first RAWG result. The My Games screen shows a safe no-match message. Verify against claims with editions, abbreviations, DLC titles, and similarly named sequels.
- **RAWG query has a platform suffix:** claimed-offer lookup strips common trailing platform labels such as `(PC)`, `(Steam)`, PS5, Xbox and Nintendo Switch before the RAWG request and match scoring.
- **PC FPS data:** FPSHQ lookup is live in the optional PC compatibility route. Verify GPU/CPU autocomplete and a measured and a predicted game forecast on web and Android; verify Firestore save only after rules are published. No FPSHQ API key is needed. Catalog-wide filtering remains outstanding.
- **GIF profile search previously showed `FirebaseError: not-found`:** Tenor stopped accepting new API clients in January 2026, so search was removed. The app now permits optional local photo/GIF uploads through `EXPO_PUBLIC_AVATAR_API_URL`. The owner deployed the old Worker at `https://gamepal-gif-search.thakurmithlesh988.workers.dev`; it must be redeployed from this branch after creating the `gamepal-avatars` R2 bucket and setting only `FIREBASE_PROJECT_ID`. No `TENOR_API_KEY` is needed. R2 has a monthly free allowance, but activating its subscription and usage above the allowance can incur charges; see `gif-worker/README.md` before activation.
- **Profile picture requirement:** The route gate no longer forces avatar selection. Profile pictures are optional; Edit Profile offers change/remove and allows saving without an avatar. The Worker limits uploads to 5 MB and JPEG/PNG/WebP/GIF signatures. Publish updated `firestore.rules`, set `EXPO_PUBLIC_AVATAR_API_URL`, and test uploads with an authenticated account.
- **App icon still showed GAME HUB:** Expo config and adaptive icon assets now use the colored controller mark without wordmark. Android launcher resource changes in this workspace are under the ignored `/android` output; run the prebuild command above before building a new APK on another checkout.
- **Game shelves were empty / scrollbar looked native:** Home category grouping and layout were revised; no recent browser QA was performed.
- **Profile edit unmatched route / app startup issues:** profile editor route and root route gating have been updated historically; test after generating a current APK.
- **Firestore rules line 98:** corrected locally as documented above; remote publish remains unconfirmed.

## 9. Next work recommended

1. Ask the owner to confirm whether the corrected entire `firestore.rules` file publishes. If not, get the exact current Console message and line; do not guess.
2. Have the owner build using Java 17 and the arm64-only Gradle command. If it fails, collect the full CMake diagnostic before changing ABIs or native configuration.
3. Verify claimed offer layout on Realme Narzo 50 Pro: Claim/Open/Share stay inside narrow cards, and actions remain usable.
4. Verify a `type: loot` claim lands in **Claimed DLC**, a game claim lands in **Claimed Offers**, and tapping a claimed game resolves through RAWG to the correct detail page.
5. Test legacy friend search only after each old account opens Friends once. Verify rules are published and report permission-denied errors accurately.
6. Run the web app via `npm run web`; check desktop, tablet, mobile, tabs, search/sidebar alignment, category shelves, detail navigation, reduced-motion behavior, and giveaway layout.
7. Do not add or run automated tests unless the owner asks; keep a clear record of what was actually verified.

## 10. PC compatibility / FPS feature research and implementation

The owner wants users to save PC specs, filter to games that should run, and see expected FPS. Research on 2026-11-19 identified the FPSHQ API as the strongest practical candidate found for a prototype/initial integration:

- Official docs: `https://fpshq.com/en/api-docs/`.
- Documents `/search` for game/GPU/CPU slugs, `/fps` for game + GPU + optional CPU + resolution + preset, and paginated `/games`, `/gpus`, `/cpus` catalogs. It returns FPS, verdict, benchmark-versus-prediction source, and may return uncertainty ranges.
- Vendor describes its catalog as ~60k games, ~1.9k GPUs, ~415 CPUs and ~58k FPS measurement rows. Its terms state commercial use is allowed with visible attribution. Fair-use guidance is approximately 60 requests/minute/IP and responses are cached for one hour; confirm sustained production volume/terms directly with the provider before launch.
- Do not label a modeled projection as measured FPS. Surface the source, resolution/preset, and range/confidence. Real results vary with laptop power limits, thermals, drivers, RAM, patches, upscaling, and in-game scenes.
- A mobile app cannot automatically detect a Windows desktop’s CPU/GPU/RAM. The safe first design is user-entered specs saved to their own Firestore profile. A future auto-detection companion must be a separate signed desktop app, transparent, opt-in, and minimized to hardware identifiers.
- Avoid requesting one forecast for every RAWG game on every app open. Use user search / current visible results, a bounded recommendation set, memoized per-spec forecasts, local/server cache with expiry, request deduplication, and graceful behavior on provider limits. For robust commercial scale, abstract the FPS provider behind `lib/` or a backend and confirm service terms/SLA and volume with FPSHQ. The separate backend also protects future private credentials, though this API currently documents no key requirement.
- Other researched options: PCGameBenchmarks-associated GitHub snapshots list requirements and modeled FPS for 17k+ games under CC BY 4.0 and report estimates can be off about 30% typically / 40% for integrated GPUs; useful for offline comparison but not a live guaranteed API. PCGamingWiki offers useful game metadata but rate-limits and is not an FPS-prediction service. System Requirements Lab documents a site-integrator path; request a partnership/API quote before relying on it for a commercial integration.
- Implemented initial cross-platform slice: optional **PC compatibility** onboarding/settings route, manual CPU/GPU/RAM + resolution/preset, FPSHQ search/autocomplete, saved private Firestore specs, and per-game forecast with visible “estimate” / “measured” labels and attribution. Catalog-wide filtering remains next; integrate via bounded current Home results and cached lookups rather than a forecast for every title.

## 11. API sourcing and current recommendation

The current catalog remains RAWG. Its claimed-title resolver fix is implemented, but no provider change was made. For production, fix match quality through conservative title resolution and provider abstraction; do not swap to a second catalog API without checking content coverage, image rights, attribution, quotas, and commercial terms. Separately, move any API key that must remain secret out of `EXPO_PUBLIC_*` into a trusted backend. The FPSHQ API is promising for PC FPS lookup but should be evaluated on representative laptop/integrated GPUs and real user configurations before presenting its projections as dependable.

## 12. Appearance palettes and animated background marks

- User-requested palettes are Classic (existing gold), Xbox green, PlayStation blue, Nintendo red, Neon purple, and RGB. Palette selection is in a dedicated **Appearance** card on Profile, with the bulb cycling Light/Dark/Auto.
- RGB cycles only the accent color, not screen backgrounds. Xbox/PlayStation brand marks appear at low opacity and float slowly behind primary app screens. `useReducedMotion()` disables their movement.
- The brand marks use FontAwesome5’s local icon fonts, so no remote images/network requests are introduced. Verify visible layering on Android and the web; adjust if they sit over opaque content.

## 13. Session collaboration notes

- The owner prefers concise, direct help and often wants commands/files to copy and run themselves.
- The owner previously asked to conserve tokens and run Android builds locally; provide exact commands when requested and distinguish debug vs release APKs.
- Do not ask for `.env` values. Work with variable names and report missing config without revealing values.
- Do not claim remote Firestore rules have been published; editing `firestore.rules` only changes this workspace.
- Preserve all existing uncommitted changes and the named checkpoint branch.
