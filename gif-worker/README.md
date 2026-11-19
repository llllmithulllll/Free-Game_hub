# GamePal Avatar Upload Worker

This Worker accepts optional user-selected profile photos and animated GIF files. It verifies Firebase ID tokens before storing uploads in a private Cloudflare R2 bucket, then serves avatar files publicly by their random URL so signed-in friends can see them. Tenor search and its API key are no longer used.

## Configure Cloudflare R2

R2 does not require Firebase Blaze. Cloudflare currently includes a monthly free allowance for Standard storage, operations, and egress, but enabling R2 requires subscription/billing activation. Usage above the included allowance is billable; check the current [R2 pricing](https://developers.cloudflare.com/r2/pricing/) before enabling it.

1. In Cloudflare Dashboard, open **Storage & databases → R2** and complete the R2 subscription activation.
2. From PowerShell, create the bucket referenced in `wrangler.toml`:

```powershell
cd E:\project\app\gif-worker
wrangler r2 bucket create gamepal-avatars
```

## Deploy the Worker

The existing `gamepal-gif-search` Worker name and URL are reused for compatibility. It no longer calls Tenor. From the same `gif-worker` folder:

```powershell
wrangler login
wrangler secret put FIREBASE_PROJECT_ID
wrangler deploy
```

When prompted, enter the Firebase project ID used by `EXPO_PUBLIC_FIREBASE_PROJECT_ID` in your local app `.env`. Wrangler encrypts the secret and will not display it later; re-run `wrangler secret put FIREBASE_PROJECT_ID` to replace it. The Tenor secret is not needed and may be deleted with `wrangler secret delete TENOR_API_KEY`.

The Worker URL is:

```text
https://gamepal-gif-search.thakurmithlesh988.workers.dev
```

In the project root `.env`, replace the old `EXPO_PUBLIC_GIF_API_URL` entry with:

```dotenv
EXPO_PUBLIC_AVATAR_API_URL=https://gamepal-gif-search.thakurmithlesh988.workers.dev
```

Restart Expo with `npx expo start -c`. The upload screen accepts JPEG, PNG, WebP, and animated GIF up to 5 MB. The Worker validates file signatures, requires a signed-in Firebase account to upload/delete, and only permits deleting objects under that account's UID. Avatar reads are public because profile pictures are shown on public profiles and friend rows.

For production web, add the exact production website origin to `ALLOWED_ORIGINS` in `wrangler.toml` and deploy again. The existing local origins cover Expo web development; Android native requests do not send a browser Origin header. Publish the updated root `firestore.rules` after this avatar schema change.
