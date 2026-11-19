# GamePal GIF Worker

This Cloudflare Worker proxies Tenor search and GIF URL resolution without a Firebase Functions deployment. It verifies Firebase ID tokens before calling Tenor, so `TENOR_API_KEY` never ships in the app bundle.

## Deploy on Cloudflare's Free plan

1. Create a Cloudflare account and enable the free `workers.dev` subdomain.
2. Create a Tenor API key in Google Cloud Console. Do not place it in the Expo `.env`.
3. Install Wrangler if needed: `npm install -g wrangler`.
4. From the project root, run:

```powershell
cd gif-worker
wrangler login
wrangler secret put TENOR_API_KEY
wrangler secret put FIREBASE_PROJECT_ID
wrangler deploy
```

Wrangler prompts for each secret. Enter the Tenor API key for the first prompt and the Firebase project ID (the value used by `EXPO_PUBLIC_FIREBASE_PROJECT_ID` in the local app `.env`) for the second. Wrangler encrypts secrets and will not display their values later; this is expected. If a value needs correction, run the same `wrangler secret put <NAME>` command again to replace it. Never paste secret values into chat or source control.

The deployed Worker URL is `https://gamepal-gif-search.thakurmithlesh988.workers.dev`. Add it to the project root `.env`:

```dotenv
EXPO_PUBLIC_GIF_API_URL=https://gamepal-gif-search.thakurmithlesh988.workers.dev
```

Restart Expo with `npx expo start -c`. To check setup, sign in to the app and search for a GIF; successful results confirm that the Worker URL and required Cloudflare secrets are usable. A missing/incorrect secret causes the Worker to return a configuration error. The deploy output listed `ALLOWED_ORIGINS`; verify the `TENOR_API_KEY` and `FIREBASE_PROJECT_ID` secrets were added to the same Cloudflare Worker environment. For production web, add the exact production origin to `ALLOWED_ORIGINS` in `wrangler.toml` and deploy again. The existing local origins cover Expo web development; Android native requests do not send a browser Origin header.

Publish the updated root `firestore.rules` after the avatar schema change. The worker does not need Firebase Blaze or access to Firestore admin credentials. Profile documents store a Tenor GIF ID, and the app resolves its current media URL through the worker on demand.
