import { auth, db } from "@/lib/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

const API = "https://fpshq.com/api/v1";
// Mobile links and the public FPS API can take longer on first connection.
const REQUEST_TIMEOUT_MS = 30000;
const CACHE_PREFIX = "@gamehub_pc_api_cache_v1:";
const CACHE_TTL_MS = 60 * 60 * 1000;
const HARDWARE_CATALOG_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PC_PROFILE_CACHE_KEY = "@gamehub_pc_profile_local_v1";

export type HardwareKind = "gpu" | "cpu" | "game";
export type HardwareOption = { type: HardwareKind; slug: string; name: string; year?: number; customOnly?: boolean };
export type PcProfile = {
  deviceType?: "desktop" | "laptop";
  gpuSlug: string;
  gpuName: string;
  cpuSlug: string;
  cpuName: string;
  ramGb: number;
  resolution: "1080p" | "1440p" | "4K";
  preset: "low" | "medium" | "high" | "ultra";
};
export type FpsEstimate = {
  fps: number;
  fps_min?: number;
  fps_max?: number;
  fps_range?: { min?: number; max?: number } | null;
  fps_1pct_low?: number;
  verdict?: string;
  source?: string;
  url?: string;
  game?: { name?: string; slug?: string };
  gpu?: { name?: string; slug?: string };
  cpu?: { name?: string; slug?: string };
};

async function request<T>(path: string): Promise<T> {
  // React Native's fetch + AbortController combination can stall on some
  // Android devices. XHR uses the native networking stack and its own timeout.
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `${API}${path}`, true);
    xhr.timeout = REQUEST_TIMEOUT_MS;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(xhr.status === 429
          ? "FPS lookup is busy. Please wait a moment and try again."
          : `FPS service returned ${xhr.status}. Please try again later.`));
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText) as T);
      } catch {
        reject(new Error("FPS service returned an unreadable response. Please try again later."));
      }
    };
    xhr.onerror = () => reject(new Error("Could not connect to FPSHQ. Check your internet connection or try another network."));
    xhr.ontimeout = () => reject(new Error("FPSHQ took too long to respond. Please try again in a moment."));
    xhr.onabort = () => reject(new Error("FPS lookup was interrupted. Please try again."));
    try {
      xhr.send();
    } catch {
      reject(new Error("Could not start the FPS lookup. Check your internet connection and try again."));
    }
  });
}

async function cachedRequest<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const cacheKey = `${CACHE_PREFIX}${key}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { savedAt: number; value: T };
      if (Date.now() - parsed.savedAt < CACHE_TTL_MS) return parsed.value;
    }
  } catch (error) {
    console.warn("Could not read local PC data cache:", error);
  }
  const value = await loader();
  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), value }));
  } catch (error) {
    console.warn("Could not store local PC data cache:", error);
  }
  return value;
}

export async function searchPcCatalog(query: string, type: HardwareKind, deviceType: "desktop" | "laptop" = "desktop"): Promise<HardwareOption[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];
  const path = `/search?q=${encodeURIComponent(clean)}&type=${type}&limit=${type === "game" ? 8 : 30}`;
  // Do not cache empty search results: a temporary service/API response must
  // not make a hardware model appear permanently unsearchable for an hour.
  const cacheKey = `${CACHE_PREFIX}search:${type}:${clean.toLowerCase()}`;
  let data: unknown;
  let loadedFromCache = false;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { savedAt?: number; value?: unknown };
      if (typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt < CACHE_TTL_MS) {
        data = parsed.value;
        loadedFromCache = true;
      }
    }
  } catch (error) {
    console.warn("Could not read hardware search cache:", error);
  }
  if (data === undefined) data = await request<unknown>(path);

  const parseOptions = (value: unknown): HardwareOption[] => {
    const payload = value as { results?: unknown; data?: unknown; items?: unknown; games?: unknown; gpus?: unknown; cpus?: unknown } | null;
    const nested = payload?.data as { results?: unknown; items?: unknown } | null;
    const rows = Array.isArray(value) ? value
      : Array.isArray(payload?.results) ? payload.results
      : Array.isArray(payload?.items) ? payload.items
      : Array.isArray(payload?.data) ? payload.data
      : Array.isArray(nested?.results) ? nested.results
      : Array.isArray(nested?.items) ? nested.items
      : Array.isArray(payload?.gpus) ? payload.gpus
      : Array.isArray(payload?.cpus) ? payload.cpus
      : Array.isArray(payload?.games) ? payload.games
      : [];
    return rows.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const item = row as Record<string, unknown>;
      if (typeof item.slug !== "string" || typeof item.name !== "string") return [];
      return [{ type, slug: item.slug, name: item.name, ...(typeof item.year === "number" ? { year: item.year } : {}) }];
    });
  };
  let options = parseOptions(data);
  // Remove a stale empty result cached by older app versions and retry once.
  if (loadedFromCache && !options.length) {
    await AsyncStorage.removeItem(cacheKey).catch(() => undefined);
    data = await request<unknown>(path);
    options = parseOptions(data);
  }
  if (options.length) {
    try { await AsyncStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), value: data })); }
    catch (error) { console.warn("Could not store hardware search cache:", error); }
  }
  if (type === "game") return options;

  // Prefer FPSHQ's query search for hardware. Loading its entire paginated
  // catalogue first made common laptop GPUs (including RTX 4050 Laptop GPU)
  // slow or invisible when their entry was not on page one.
  const localMatches = await findCachedHardwareMatches(clean, type, deviceType);
  const combined = [...options, ...localMatches];
  const normalizedQuery = normalizeHardwareName(clean);
  const terms = normalizedQuery.split(" ").filter((term) => term && !new Set(["gpu", "gpus", "graphics", "card", "cards", "video", "processor", "processors", "cpu", "nvidia", "amd", "intel"]).has(term));
  const unique = new Map<string, HardwareOption>();
  for (const item of combined) unique.set(item.slug, item);
  const ranked = [...unique.values()]
    .map((item) => {
      const normalized = normalizeHardwareName(item.name);
      const candidateTerms = normalized.split(" ");
      const matched = terms.filter((term) => candidateTerms.some((candidate) => hardwareTokenMatches(term, candidate))).length;
      const portable = /\b(laptop|mobile|notebook|max[ -]?q)\b/i.test(item.name);
      return { item, normalized, matched, portable };
    })
    .filter((entry) => !terms.length || entry.matched >= Math.max(1, terms.length - 1))
    .sort((a, b) => {
      const aDevice = deviceType === "laptop" ? Number(!a.portable) : Number(a.portable);
      const bDevice = deviceType === "laptop" ? Number(!b.portable) : Number(b.portable);
      return b.matched - a.matched || aDevice - bDevice || a.normalized.length - b.normalized.length;
    })
    .slice(0, 12)
    .map(({ item }) => item);
  if (ranked.length) return ranked;

  // Search results can occasionally lag behind the paginated catalog. Only
  // scan that catalog after a successful but empty name search, never after a
  // network error (which should surface immediately to the user).
  return searchHardwareCatalog(clean, type, deviceType);
}

function normalizeHardwareName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hardwareTokenMatches(queryToken: string, candidateToken: string) {
  if (queryToken === candidateToken) return true;
  if (Math.abs(queryToken.length - candidateToken.length) > 1 || Math.min(queryToken.length, candidateToken.length) < 3) return false;
  let left = 0;
  let right = 0;
  let edits = 0;
  while (left < queryToken.length && right < candidateToken.length) {
    if (queryToken[left] === candidateToken[right]) {
      left += 1;
      right += 1;
      continue;
    }
    if (left + 1 < queryToken.length && right + 1 < candidateToken.length
      && queryToken[left] === candidateToken[right + 1]
      && queryToken[left + 1] === candidateToken[right]) {
      edits += 1;
      left += 2;
      right += 2;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (queryToken.length > candidateToken.length) left += 1;
    else if (queryToken.length < candidateToken.length) right += 1;
    else { left += 1; right += 1; }
  }
  if (left < queryToken.length || right < candidateToken.length) edits += 1;
  return edits <= 1;
}

async function searchHardwareCatalog(query: string, type: "gpu" | "cpu", deviceType: "desktop" | "laptop"): Promise<HardwareOption[]> {
  const cacheKey = `${CACHE_PREFIX}catalog_v2:${type}`;
  let catalog: HardwareOption[] = [];
  let loadedPage = 0;
  let totalPages = 1;
  try {
    const saved = await AsyncStorage.getItem(cacheKey);
    if (saved) {
      const parsed = JSON.parse(saved) as { savedAt?: number; items?: HardwareOption[]; loadedPage?: number; totalPages?: number };
      if (Array.isArray(parsed.items) && Date.now() - Number(parsed.savedAt || 0) < HARDWARE_CATALOG_TTL_MS) {
        catalog = parsed.items;
        loadedPage = Number(parsed.loadedPage) || 0;
        totalPages = Number(parsed.totalPages) || 1;
      }
    }
  } catch (error) {
    console.warn("Could not read local hardware catalog:", error);
  }

  const endpoint = type === "gpu" ? "gpus" : "cpus";
  const parseItems = (value: unknown): HardwareOption[] => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const item = row as Record<string, unknown>;
      if (typeof item.slug !== "string" || typeof item.name !== "string") return [];
      return [{ type, slug: item.slug, name: item.name, ...(typeof item.year === "number" ? { year: item.year } : {}) }];
    });
  };
  const normalizedQuery = normalizeHardwareName(query);
  const genericTerms = new Set(["gpu", "gpus", "graphics", "card", "cards", "video", "processor", "processors", "cpu", "nvidia", "amd", "intel"]);
  const terms = normalizedQuery.split(" ").filter((term) => term && !genericTerms.has(term));
  if (!terms.length) throw new Error("Enter a model name or number, such as RTX 4050 or Ryzen 5 5600.");
  const findMatches = () => catalog
      .map((item) => {
        const normalized = normalizeHardwareName(item.name);
        const candidateTerms = normalized.split(" ");
        const matchedTerms = terms.filter((term) => candidateTerms.some((candidate) => hardwareTokenMatches(term, candidate)));
        return { item, normalized, portable: /\b(laptop|mobile|notebook|max[ -]?q)\b|\b\d{4,5}(?:h|hx|hs|u)\b/i.test(item.name), matchCount: matchedTerms.length };
      })
      .filter(({ matchCount }) => matchCount === terms.length)
      .sort((left, right) => {
        const leftDeviceRank = deviceType === "laptop" ? (left.portable ? 0 : 1) : (left.portable ? 1 : 0);
        const rightDeviceRank = deviceType === "laptop" ? (right.portable ? 0 : 1) : (right.portable ? 1 : 0);
        const leftExact = left.normalized === normalizedQuery ? 1 : 0;
        const rightExact = right.normalized === normalizedQuery ? 1 : 0;
        return leftDeviceRank - rightDeviceRank || rightExact - leftExact || left.normalized.length - right.normalized.length;
      })
      .slice(0, 8)
      .map(({ item }) => item);

  if (!catalog.length) {
    const firstPage = await request<{ items?: unknown; total_pages?: number }>(`/${endpoint}?page=1&per_page=100`);
    catalog = parseItems(firstPage.items);
    loadedPage = 1;
    totalPages = Math.min(Math.max(Number(firstPage.total_pages) || 1, 1), 30);
  }

  let matches = findMatches();
  // Most searches match the first catalog page. Fetch the remaining pages only
  // when needed, then keep the partial/full catalog locally for offline search.
  while (!matches.length && loadedPage < totalPages) {
    const startPage = loadedPage + 1;
    const pages = Array.from({ length: Math.min(4, totalPages - loadedPage) }, (_, index) => startPage + index);
    const results = await Promise.all(pages.map((page) => request<{ items?: unknown }>(`/${endpoint}?page=${page}&per_page=100`)));
    catalog.push(...results.flatMap((result) => parseItems(result.items)));
    loadedPage = pages[pages.length - 1];
    matches = findMatches();
  }
  if (catalog.length) {
    try { await AsyncStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), items: catalog, loadedPage, totalPages })); }
    catch (error) { console.warn("Could not cache hardware catalog:", error); }
  }

  if (!matches.length) throw new Error(`No ${type === "gpu" ? "graphics cards" : "processors"} matched “${query}”. Try searching by model number, such as RTX 4070 or Ryzen 5 5600.`);
  return matches;
}

async function findCachedHardwareMatches(query: string, type: "gpu" | "cpu", deviceType: "desktop" | "laptop"): Promise<HardwareOption[]> {
  try {
    const saved = await AsyncStorage.getItem(`${CACHE_PREFIX}catalog_v2:${type}`);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as { items?: HardwareOption[] };
    if (!Array.isArray(parsed.items)) return [];
    const terms = normalizeHardwareName(query).split(" ").filter((term) => term && !["gpu", "gpus", "graphics", "card", "cards", "video", "processor", "processors", "cpu", "nvidia", "amd", "intel"].includes(term));
    return parsed.items
      .filter((item) => {
        const candidateTerms = normalizeHardwareName(item.name).split(" ");
        const count = terms.filter((term) => candidateTerms.some((candidate) => hardwareTokenMatches(term, candidate))).length;
        return !terms.length || count >= Math.max(1, terms.length - 1);
      })
      .sort((a, b) => {
        const aPortable = /\b(laptop|mobile|notebook|max[ -]?q)\b/i.test(a.name);
        const bPortable = /\b(laptop|mobile|notebook|max[ -]?q)\b/i.test(b.name);
        const aRank = deviceType === "laptop" ? Number(!aPortable) : Number(aPortable);
        const bRank = deviceType === "laptop" ? Number(!bPortable) : Number(bPortable);
        return aRank - bRank || a.name.length - b.name.length;
      })
      .slice(0, 12);
  } catch (error) {
    console.warn("Could not search cached hardware catalog:", error);
    return [];
  }
}

export async function fetchFpsEstimate(game: HardwareOption, pc: PcProfile): Promise<FpsEstimate> {
  const query = `game=${encodeURIComponent(game.slug)}&gpu=${encodeURIComponent(pc.gpuSlug)}&cpu=${encodeURIComponent(pc.cpuSlug)}&res=${pc.resolution}&preset=${pc.preset}`;
  const cacheKey = `fps:${query}`;
  try {
    return await cachedRequest(cacheKey, async () => {
      const data = await request<FpsEstimate & { ok?: boolean }>(`/fps?${query}`);
      if (typeof data.fps !== "number" || !Number.isFinite(data.fps)) {
        throw new Error("FPS data is unavailable for this game and hardware combination.");
      }
      return data;
    });
  } catch (error) {
    // Remove invalid responses cached by older app builds so they don't keep
    // failing every retry until the cache TTL expires.
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${cacheKey}`).catch(() => undefined);
    throw error;
  }
}

export async function loadPcProfile(): Promise<PcProfile | null> {
  let local: PcProfile | null = null;
  try {
    const saved = await AsyncStorage.getItem(PC_PROFILE_CACHE_KEY);
    if (saved) local = JSON.parse(saved) as PcProfile;
  } catch (error) {
    console.warn("Could not read local PC profile:", error);
  }
  const user = auth.currentUser;
  if (!user) return local;
  try {
    const snapshot = await getDoc(doc(db, "users", user.uid, "pcProfile", "specs"));
    if (!snapshot.exists()) return local;
    const data = snapshot.data();
    if (!data.gpuSlug || !data.cpuSlug || !data.ramGb) return local;
    const profile = { ...data, deviceType: local?.gpuSlug === data.gpuSlug && local?.cpuSlug === data.cpuSlug
      ? local?.deviceType
      : /laptop|mobile|notebook|max[ -]?q/i.test(String(data.gpuName)) ? "laptop" : "desktop" } as PcProfile;
    await AsyncStorage.setItem(PC_PROFILE_CACHE_KEY, JSON.stringify(profile)).catch(() => undefined);
    return profile;
  } catch (error) {
    // Keep hardware usable on this device when Firestore rules are not yet published.
    if (local) return local;
    throw error;
  }
}

export async function savePcProfile(profile: PcProfile): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to save your PC details.");
  await AsyncStorage.setItem(PC_PROFILE_CACHE_KEY, JSON.stringify(profile));
  try {
    await setDoc(doc(db, "users", user.uid, "pcProfile", "specs"), {
      deviceType: profile.deviceType || "desktop",
      gpuSlug: profile.gpuSlug,
      gpuName: profile.gpuName,
      cpuSlug: profile.cpuSlug,
      cpuName: profile.cpuName,
      ramGb: profile.ramGb,
      resolution: profile.resolution,
      preset: profile.preset,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.warn("PC profile saved locally but account sync failed:", error);
    return false;
  }
}

