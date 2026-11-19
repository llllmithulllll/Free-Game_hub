type RawgSearchResult = {
  id: number | string;
  name: string;
  background_image?: string | null;
};

export function removePlatformSuffix(name: string): string {
  return name
    .replace(/[([]\s*(?:PC|Windows|Steam|Epic Games(?: Store)?|GOG(?:\.com)?|PlayStation(?:\s*[345])?|PS[345]|Xbox(?:\s*(?:One|Series\s*[XS]))?|Nintendo Switch|Switch)\s*[\])]\s*$/i, "")
    .replace(/\s*[-–—|]\s*(?:PC|Windows|Steam|Epic Games(?: Store)?|GOG(?:\.com)?)\s*$/i, "");
}

function normalizeGameName(name: string): string {
  const titleWithoutPlatform = name
    .replace(/[([]\s*(?:PC|Windows|Steam|Epic Games(?: Store)?|GOG(?:\.com)?|PlayStation(?:\s*[345])?|PS[345]|Xbox(?:\s*(?:One|Series\s*[XS]))?|Nintendo Switch|Switch)\s*[\])]\s*$/i, "")
    .replace(/\s*[-–—|]\s*(?:PC|Windows|Steam|Epic Games(?: Store)?|GOG(?:\.com)?)\s*$/i, "");
  return titleWithoutPlatform
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreTitleMatch(query: string, candidate: string): number {
  const queryName = normalizeGameName(query);
  const candidateName = normalizeGameName(candidate);
  if (!queryName || !candidateName) return 0;
  if (queryName === candidateName) return 1;

  const queryWords = [...new Set(queryName.split(" ").filter(Boolean))];
  const candidateWords = [...new Set(candidateName.split(" ").filter(Boolean))];
  const sharedWords = queryWords.filter((word) => candidateWords.includes(word)).length;
  const smallerCount = Math.min(queryWords.length, candidateWords.length);
  // One-word matches (for example, a franchise name shared by several sequels)
  // are too ambiguous to open automatically.
  if (smallerCount < 2 || sharedWords < 2) return 0;

  const coverage = sharedWords / smallerCount;
  const jaccard = sharedWords / (queryWords.length + candidateWords.length - sharedWords);
  const startsWithMatch = queryName.startsWith(candidateName) || candidateName.startsWith(queryName);
  return 0.65 * coverage + 0.35 * jaccard + (startsWithMatch ? 0.04 : 0);
}

/** Finds a claimed giveaway in the same RAWG catalog used by Home. */
export async function findCatalogGameByTitle(title: string): Promise<RawgSearchResult | null> {
  const apiKey = process.env.EXPO_PUBLIC_RAWG_API_KEY;
  if (!apiKey) throw new Error("The game catalog is not configured on this build.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const searchTitle = title
      .replace(/[([]\s*(?:PC|Windows|Steam|Epic Games(?: Store)?|GOG(?:\.com)?|PlayStation(?:\s*[345])?|PS[345]|Xbox(?:\s*(?:One|Series\s*[XS]))?|Nintendo Switch|Switch)\s*[\])]\s*$/i, "")
      .replace(/\s*[-–—|]\s*(?:PC|Windows|Steam|Epic Games(?: Store)?|GOG(?:\.com)?)\s*$/i, "")
      .trim();
    const params = `key=${encodeURIComponent(apiKey)}&search=${encodeURIComponent(removePlatformSuffix(searchTitle))}&page_size=10`;
    const response = await fetch(`https://api.rawg.io/api/games?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Game search failed (${response.status}).`);
    const data = await response.json();
    const results: RawgSearchResult[] = Array.isArray(data?.results) ? data.results : [];
    if (!results.length) return null;

    const target = normalizeGameName(title);
    const exact = results.find((game) => normalizeGameName(game.name) === target);
    if (exact) return exact;

    const ranked = results
      .map((game) => ({ game, score: scoreTitleMatch(title, game.name) }))
      .sort((left, right) => right.score - left.score);
    const best = ranked[0];
    const next = ranked[1];
    // A wrong details page is worse than asking the player to search manually.
    // Reject low-confidence results and near-ties between similar game names.
    if (!best || best.score < 0.82 || (next && best.score - next.score < 0.06)) return null;
    return best.game;
  } finally {
    clearTimeout(timeout);
  }
}
