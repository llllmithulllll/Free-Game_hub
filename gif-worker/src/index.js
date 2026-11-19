const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function response(data, status, origin, extraHeaders = {}) {
  return new Response(data, {
    status,
    headers: {
      ...(typeof data === "string" ? { "content-type": "application/json; charset=utf-8" } : {}),
      "access-control-allow-origin": origin || "*",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "authorization, content-type",
      "vary": "Origin",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

function json(data, status, origin) {
  return response(JSON.stringify(data), status, origin, { "cache-control": "no-store" });
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
    await cache.put(cacheKey, new Response(await response.clone().text(), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
    }));
  }
  return response.json();
}

async function verifyFirebaseUser(request, projectId) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== "RS256" || typeof header.kid !== "string") return null;
    if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (typeof claims.sub !== "string" || !claims.sub || typeof claims.exp !== "number" || claims.exp <= now
      || typeof claims.iat !== "number" || claims.iat > now) return null;
    let keys = await firebaseSigningKeys();
    let jwk = keys.keys?.find((key) => key.kid === header.kid);
    if (!jwk) {
      await caches.default.delete(new Request(FIREBASE_JWKS_URL));
      keys = await firebaseSigningKeys();
      jwk = keys.keys?.find((key) => key.kid === header.kid);
    }
    if (!jwk) return null;
    const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, decodeBase64Url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    return valid ? claims.sub : null;
  } catch {
    return null;
  }
}

function detectImageType(bytes) {
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return { mime: "image/gif", extension: "gif" };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return { mime: "image/png", extension: "png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { mime: "image/webp", extension: "webp" };
  return null;
}

function safeAvatarKey(key) {
  return typeof key === "string" && /^[A-Za-z0-9_-]{1,128}\/[a-f0-9-]{36}\.(jpg|png|gif|webp)$/.test(key);
}

async function readLimitedBody(request) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_AVATAR_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    const allowedOrigins = (env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean);
    if (origin && !allowedOrigins.includes(origin)) return json({ error: "Origin not allowed." }, 403, origin);
    if (request.method === "OPTIONS") return json({}, 200, origin);

    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === "GET" && path.startsWith("/avatar/")) {
      if (!env.AVATARS) return json({ error: "Avatar storage is not configured." }, 503, origin);
      const key = path.slice("/avatar/".length);
      if (!safeAvatarKey(key)) return json({ error: "Invalid avatar path." }, 400, origin);
      const object = await env.AVATARS.get(key);
      if (!object) return json({ error: "Avatar not found." }, 404, origin);
      return response(object.body, 200, origin, {
        "content-type": object.httpMetadata?.contentType || "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
        "etag": object.httpEtag,
      });
    }

    if (!env.FIREBASE_PROJECT_ID) return json({ error: "Avatar service is not configured." }, 503, origin);
    const uid = await verifyFirebaseUser(request, env.FIREBASE_PROJECT_ID);
    if (!uid) return json({ error: "Sign-in required." }, 401, origin);
    if (!env.AVATARS) return json({ error: "Avatar storage is not configured." }, 503, origin);

    if (request.method === "POST" && path === "/upload") {
      const declaredSize = Number(request.headers.get("content-length") || 0);
      if (declaredSize > MAX_AVATAR_BYTES) return json({ error: "Choose an image or GIF smaller than 5 MB." }, 413, origin);
      const bytes = await readLimitedBody(request);
      if (!bytes || bytes.byteLength === 0) return json({ error: "Choose an image or GIF smaller than 5 MB." }, 413, origin);
      const type = detectImageType(bytes);
      const declaredType = (request.headers.get("content-type") || "").split(";")[0].toLowerCase();
      if (!type || declaredType !== type.mime) return json({ error: "Only valid JPEG, PNG, WebP, and GIF files are supported." }, 415, origin);
      const key = `${uid}/${crypto.randomUUID()}.${type.extension}`;
      await env.AVATARS.put(key, bytes, {
        httpMetadata: { contentType: type.mime, cacheControl: "public, max-age=31536000, immutable" },
        customMetadata: { ownerUid: uid },
      });
      return json({ key, url: `${url.origin}/avatar/${key}` }, 201, origin);
    }

    if (request.method === "POST" && path === "/delete") {
      let data;
      try { data = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400, origin); }
      const key = data?.key;
      if (!safeAvatarKey(key) || !key.startsWith(`${uid}/`)) return json({ error: "Invalid avatar key." }, 400, origin);
      await env.AVATARS.delete(key);
      return json({ ok: true }, 200, origin);
    }

    return json({ error: "Unknown endpoint." }, 404, origin);
  },
};
