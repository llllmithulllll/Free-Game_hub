const TENOR_BASE = "https://tenor.googleapis.com/v2";
const TENOR_MEDIA_HOST = "https://media.tenor.com/";
const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin || "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, content-type",
      "vary": "Origin",
      "cache-control": "no-store",
    },
  });
}

function decodeBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function firebaseSigningKeys() {
  const cache = caches.default;
  const cacheKey = new Request(FIREBASE_JWKS_URL);
  let response = await cache.match(cacheKey);
  if (!response) {
    response = await fetch(FIREBASE_JWKS_URL);
    if (!response.ok) throw new Error("Could not load Firebase signing keys.");
    const cachedResponse = new Response(await response.clone().text(), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
    });
    await cache.put(cacheKey, cachedResponse);
  }
  return response.json();
}

async function verifyFirebaseToken(request, projectId) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== "RS256" || typeof header.kid !== "string") return false;
    if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) return false;
    if (typeof claims.sub !== "string" || claims.sub.length === 0
      || typeof claims.exp !== "number" || claims.exp <= now
      || typeof claims.iat !== "number" || claims.iat > now) return false;
    let keys = await firebaseSigningKeys();
    let jwk = keys.keys?.find((key) => key.kid === header.kid);
    if (!jwk) {
      // Refresh the cached key set once to handle key rotation.
      await caches.default.delete(new Request(FIREBASE_JWKS_URL));
      keys = await firebaseSigningKeys();
      jwk = keys.keys?.find((key) => key.kid === header.kid);
    }
    if (!jwk) return false;
    const publicKey = await crypto.subtle.importKey(
      "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
    );
    return crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", publicKey, decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return false;
  }
}

function extractGif(item) {
  const previewUrl = item.media_formats?.tinygif?.url;
  const url = item.media_formats?.gif?.url;
  if (!item.id || !previewUrl?.startsWith(TENOR_MEDIA_HOST) || !url?.startsWith(TENOR_MEDIA_HOST)) return null;
  return { id: String(item.id), title: String(item.title || "Animated GIF").slice(0, 100), previewUrl, url };
}

export default {
  async fetch(request, env) {
    const requestOrigin = request.headers.get("origin") || "";
    const allowedOrigins = (env.ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean);
    if (requestOrigin && !allowedOrigins.includes(requestOrigin)) return json({ error: "Origin not allowed." }, 403, requestOrigin);
    if (request.method === "OPTIONS") return json({}, 200, requestOrigin);
    if (request.method !== "POST") return json({ error: "POST required." }, 405, requestOrigin);
    if (!env.TENOR_API_KEY || !env.FIREBASE_PROJECT_ID) return json({ error: "GIF service is not configured." }, 503, requestOrigin);
    if (!await verifyFirebaseToken(request, env.FIREBASE_PROJECT_ID)) return json({ error: "Sign-in required." }, 401, requestOrigin);

    const path = new URL(request.url).pathname;
    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: "Invalid JSON." }, 400, requestOrigin);
    }

    const params = new URLSearchParams({ key: env.TENOR_API_KEY, client_key: "gamepal", media_filter: "tinygif,gif" });
    let endpoint;
    if (path.endsWith("/search")) {
      const query = typeof data.query === "string" ? data.query.trim().slice(0, 60) : "";
      if (query.length < 2) return json({ error: "Enter at least two characters." }, 400, requestOrigin);
      params.set("q", query);
      params.set("limit", "24");
      params.set("contentfilter", "high");
      endpoint = `${TENOR_BASE}/search?${params}`;
    } else if (path.endsWith("/resolve")) {
      const ids = Array.isArray(data.ids) ? [...new Set(data.ids.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 80))].slice(0, 50) : [];
      if (!ids.length) return json([], 200, requestOrigin);
      params.set("ids", ids.join(","));
      endpoint = `${TENOR_BASE}/posts?${params}`;
    } else {
      return json({ error: "Unknown endpoint." }, 404, requestOrigin);
    }

    try {
      const tenorResponse = await fetch(endpoint, { signal: AbortSignal.timeout(10_000) });
      if (!tenorResponse.ok) return json({ error: "GIF search is temporarily unavailable." }, 502, requestOrigin);
      const payload = await tenorResponse.json();
      const results = (payload.results || []).map(extractGif).filter(Boolean);
      return json(results, 200, requestOrigin);
    } catch {
      return json({ error: "GIF search is temporarily unavailable." }, 502, requestOrigin);
    }
  },
};
