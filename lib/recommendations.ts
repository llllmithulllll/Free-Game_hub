export type DiscoveryState = {
  recentIds: string[];
  genreExposure: Record<string, number>;
};

/** Weighted random ordering: favorite and previously explored genres surface more often. */
export function randomizeGames<T extends { id: string | number; genre?: string; genres?: string[]; tags?: string[] }>(
  games: T[],
  preferredCategories: string[],
  state: DiscoveryState,
): T[] {
  const preferred = new Set(preferredCategories.map((item) => item.toLowerCase()));
  const recent = new Set(state.recentIds);

  return games
    .map((game) => {
      const genres = (game.genres?.length ? game.genres : game.genre ? [game.genre] : [])
        .map((item) => item.toLowerCase());
      const tags = (game.tags || []).map((tag) => tag.toLowerCase());
      const preferenceBoost = [...genres, ...tags].some((genre) => preferred.has(genre)) ? 2.4 : 1;
      const exposure = Math.max(0, ...genres.map((genre) => state.genreExposure[genre] || 0));
      const learnedBoost = 1 + Math.min(0.8, Math.log1p(exposure) * 0.2);
      const freshness = recent.has(String(game.id)) ? 0.42 : 1;
      const weight = preferenceBoost * learnedBoost * freshness;
      return { game, key: -Math.log(Math.max(Number.EPSILON, Math.random())) / weight };
    })
    .sort((left, right) => left.key - right.key)
    .map(({ game }) => game);
}

/** Count feed impressions by genre and remember recently surfaced games. */
export function updateDiscoverySignals(state: DiscoveryState, shown: { id: string | number; genre?: string; genres?: string[] }[]): DiscoveryState {
  const genreExposure = { ...state.genreExposure };
  for (const game of shown) {
    const genre = game.genres?.[0] || game.genre;
    if (genre) {
      const key = genre.toLowerCase();
      genreExposure[key] = (genreExposure[key] || 0) + 1;
    }
  }

  return {
    genreExposure,
    recentIds: [...shown.map((game) => String(game.id)), ...state.recentIds]
      .filter((id, index, all) => all.indexOf(id) === index)
      .slice(0, 60),
  };
}
