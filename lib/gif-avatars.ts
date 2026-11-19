import { auth } from "@/lib/firebase";

export type ProfileGif = { id: string; title: string; previewUrl: string; url: string };

const GIF_API_URL = process.env.EXPO_PUBLIC_GIF_API_URL?.replace(/\/$/, "");
const resolvedUrls = new Map<string, { gif: ProfileGif; expiresAt: number }>();
const pendingResolvers = new Map<string, { resolve: (gif: ProfileGif | null) => void; reject: (error: Error) => void }[]>();
let resolveTimer: ReturnType<typeof setTimeout> | null = null;

async function callGifApi<T>(path: "search" | "resolve", body: unknown): Promise<T> {
  if (!GIF_API_URL) throw new Error("Set EXPO_PUBLIC_GIF_API_URL to your deployed GIF Worker URL.");
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to search GIFs.");
  const token = await user.getIdToken();
  const response = await fetch(`${GIF_API_URL}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`GIF service returned ${response.status}.`);
  return response.json() as Promise<T>;
}

export async function searchProfileGifs(query: string): Promise<ProfileGif[]> {
  return callGifApi<ProfileGif[]>("search", { query });
}

function flushResolveQueue() {
  resolveTimer = null;
  const ids = [...pendingResolvers.keys()].slice(0, 50);
  if (!ids.length) return;
  const resolvers = new Map(ids.map((id) => [id, pendingResolvers.get(id) || []]));
  ids.forEach((id) => pendingResolvers.delete(id));
  void callGifApi<ProfileGif[]>("resolve", { ids }).then((gifs) => {
    const now = Date.now();
    const byId = new Map(gifs.map((gif) => [gif.id, gif]));
    for (const id of ids) {
      const gif = byId.get(id) || null;
      if (gif) resolvedUrls.set(id, { gif, expiresAt: now + 20 * 60 * 60 * 1000 });
      for (const waiter of resolvers.get(id) || []) waiter.resolve(gif);
    }
  }).catch((error: Error) => {
    for (const id of ids) for (const waiter of resolvers.get(id) || []) waiter.reject(error);
  }).finally(() => {
    if (pendingResolvers.size && !resolveTimer) resolveTimer = setTimeout(flushResolveQueue, 0);
  });
}

export function resolveProfileGif(id: string): Promise<ProfileGif | null> {
  const cached = resolvedUrls.get(id);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.gif);
  return new Promise((resolve, reject) => {
    const waiters = pendingResolvers.get(id) || [];
    waiters.push({ resolve, reject });
    pendingResolvers.set(id, waiters);
    if (!resolveTimer) resolveTimer = setTimeout(flushResolveQueue, 25);
  });
}
