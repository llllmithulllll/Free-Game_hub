import { auth, db } from "@/lib/firebase";
import { createThemedStyles, themeColors, useAppTheme, useThemedAlert } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import GamePalLoader from "@/components/GamePalLoader";
import GamingBackdrop from "@/components/GamingBackdrop";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Head from "expo-router/head";
import { useRouter } from "expo-router";
import { isSexualContentGame, shouldFilterSexualContent } from "@/lib/content-filter";
import { removePlatformSuffix } from "@/lib/game-catalog";
import { randomizeGames, type DiscoveryState, updateDiscoverySignals } from "@/lib/recommendations";
import { HttpJsonError, requestJson } from "@/lib/http-json";
import Animated, { FadeInUp, ReduceMotion } from "react-native-reanimated";

import {
  collection,
  doc,
  getDocs,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  useWindowDimensions,
} from "react-native";

// ============================================================
// CONSTANTS
// ============================================================

const CACHE_KEY = "@cached_games_list";
const DISCOVERY_KEY = "@game_discovery_state_v1";

const GENRES = [
  "Action",
  "Adventure",
  "RPG",
  "Shooter",
  "Strategy",
  "Simulation",
  "Sports",
  "Racing",
  "Puzzle",
  "Fighting",
];

const TAGS = [
  "Multiplayer",
  "Singleplayer",
  "Co-op",
  "Online Co-Op",
  "Local Co-Op",
  "PvP",
  "Open World",
  "Survival",
];

const PLATFORMS = [
  "PC",
  "PlayStation 5",
  "PlayStation 4",
  "Xbox Series S/X",
  "Xbox One",
  "Nintendo Switch",
];

const STOREFRONT_GENRES = ["Action", "Adventure", "Racing", "RPG", "Shooter", "Strategy", "Simulation", "Sports", "Puzzle", "Fighting"];

function getGameGenres(game: any): string[] {
  const values = Array.isArray(game.genres) && game.genres.length > 0
    ? game.genres
    : typeof game.genre === "string"
      ? game.genre.split(/[,/&]/)
      : [];
  return values
    .map((value: any) => typeof value === "string" ? value : value?.name)
    .filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value: string) => value.trim());
}

function getNameList(value: any): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return values
    .map((item: any) => typeof item === "string" ? item : item?.name)
    .filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item: string) => item.trim());
}

// ============================================================
// HOME
// ============================================================

export default function Home() {
  const { colors } = useAppTheme();
  const showAlert = useThemedAlert();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const desktopSidebar = isWeb && viewportWidth >= 1280;
  const columns = viewportWidth >= 1500 ? 5 : viewportWidth >= 1180 ? 4 : viewportWidth >= 840 ? 3 : 2;
  const listWidth = (isWeb ? Math.min(viewportWidth - 20, 1480) : viewportWidth - 20) - (desktopSidebar ? 330 : 0);
  const sidePadding = desktopSidebar ? 0 : isWeb ? (viewportWidth >= 768 ? 28 : 16) : 4;
  const cardWidth = Math.max(120, (listWidth - sidePadding * 2 - (columns - 1) * 12) / columns);
  // ==========================================================
  // STATE
  // ==========================================================

  const [allGames, setAllGames] = useState<any[]>([]);
  const allGamesRef = useRef<any[]>([]);

  // RAWG + Firestore search results are stored separately.
  // Filters can then operate on these results instantly.
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [filteredGames, setFilteredGames] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");

  const [filterVisible, setFilterVisible] = useState(false);

  // ==========================================================
  // FILTER STATE
  // ==========================================================

  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [, setContentFilterRevision] = useState(0);
  const preferredCategoriesRef = useRef<string[]>([]);
  const filterSexualContentRef = useRef(true);
  const discoveryState = useRef<DiscoveryState>({ recentIds: [], genreExposure: {} });
  const hasRecordedDiscovery = useRef(false);

  const router = useRouter();

  // Search debounce
  const searchTimeout =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prevent older search requests replacing newer results
  const searchRequestId = useRef(0);

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    initializeData();

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    let profile: any = {};
    let preferences: any = {};
    const refreshPersonalization = () => {
      const filter = shouldFilterSexualContent(profile.dateOfBirth, preferences.sexualContentFilter);
      filterSexualContentRef.current = filter;
      preferredCategoriesRef.current = preferences.categories || [];
      setContentFilterRevision((revision) => revision + 1);
      const randomized = randomizeGames(allGamesRef.current, preferredCategoriesRef.current, discoveryState.current);
      allGamesRef.current = randomized;
      setAllGames(randomized);
      setFilteredGames(filter ? randomized.filter((game: any) => !isSexualContentGame(game)) : randomized);
    };
    const unsubscribeProfile = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      profile = snapshot.exists() ? snapshot.data() : {};
      refreshPersonalization();
    });
    const unsubscribePreferences = onSnapshot(doc(db, "users", user.uid, "preferences", "data"), (snapshot) => {
      preferences = snapshot.exists() ? snapshot.data() : {};
      refreshPersonalization();
    });
    return () => {
      unsubscribeProfile();
      unsubscribePreferences();
    };
  }, []);

  // ==========================================================
  // INITIALIZE
  // ==========================================================

  const initializeData = async () => {
    // Render the last catalog immediately. Network reads must not hold up
    // showing cached games on a slower mobile connection.
    try {
      const [savedDiscovery, cached] = await Promise.all([
        AsyncStorage.getItem(DISCOVERY_KEY),
        AsyncStorage.getItem(CACHE_KEY),
      ]);
      if (savedDiscovery) discoveryState.current = JSON.parse(savedDiscovery);

      if (cached) {
        const parsed = JSON.parse(cached);
        const randomized = randomizeGames(parsed, preferredCategoriesRef.current, discoveryState.current);
        allGamesRef.current = randomized;
        setAllGames(randomized);
        setFilteredGames(filterSexualContentRef.current ? randomized.filter((game: any) => !isSexualContentGame(game)) : randomized);
      }
    } catch (error) {
      console.error("Cache Error:", error);
      void AsyncStorage.removeItem(CACHE_KEY);
    }

    // Start the catalog request before waiting on profile/preferences reads.
    void fetchGames(1, true);

    const user = auth.currentUser;
    if (user) {
      try {
        const [profileSnap, preferencesSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "users", user.uid, "preferences", "data")),
        ]);
        const profile = profileSnap.exists() ? profileSnap.data() : {};
        const preferences = preferencesSnap.exists() ? preferencesSnap.data() : {};
        const categories = preferences.categories || [];
        const filter = shouldFilterSexualContent(profile.dateOfBirth, preferences.sexualContentFilter);
        preferredCategoriesRef.current = categories;
        filterSexualContentRef.current = filter;
        const games = allGamesRef.current;
        if (games.length) {
          const personalized = randomizeGames(games, categories, discoveryState.current);
          allGamesRef.current = personalized;
          setAllGames(personalized);
          setFilteredGames(filter ? personalized.filter((game: any) => !isSexualContentGame(game)) : personalized);
        }
      } catch (error) {
        console.error("Content preference load error; using safe filter defaults:", error);
      }
    }
  };

  // ==========================================================
  // FORMAT RAWG GAME
  // ==========================================================

  const formatRawgGame = (game: any) => {
    const genres =
      game.genres?.map(
        (genre: any) => genre.name
      ) || [];

    const tags =
      game.tags?.map(
        (tag: any) => tag.name
      ) || [];

    const platforms =
      game.platforms?.map(
        (item: any) => item.platform.name
      ) || [];

    return {
      id: game.id.toString(),

      title: game.name,

      // Keep old genre property for compatibility
      genre:
        genres[0] ||
        "Game",

      genres,

      tags,

      esrbRating: game.esrb_rating || null,

      platforms,

      thumbnail:
        game.background_image ||
        "https://via.placeholder.com/150",
    };
  };

  // ==========================================================
  // SAVE FIRESTORE CACHE
  // ==========================================================

  const saveToGlobalCache = async (
    games: any[]
  ) => {
    if (!auth.currentUser) {
      console.log(
        "Skipping global cache write — no authenticated user"
      );

      return;
    }

    if (!games || games.length === 0) {
      return;
    }

    try {
      const batch =
        writeBatch(db);

      games.forEach(
        (game) => {
          const ref = doc(
            db,
            "global_games",
            game.id.toString()
          );

          batch.set(
            ref,

            {
              id:
                game.id.toString(),

              title:
                game.title,

              searchName:
                game.title.toLowerCase(),

              thumbnail:
                game.thumbnail,

              genre:
                game.genre,

              genres:
                game.genres || [],

              tags:
                game.tags || [],

              platforms:
                game.platforms || [],

              lastUpdated:
                serverTimestamp(),
            }
          );
        }
      );

      await batch.commit();
    } catch (error: any) {
      console.error(
        "Firestore Cache Error:",
        error?.code,
        error?.message || error
      );
    }
  };

  // ==========================================================
  // FILTER GAMES LOCALLY
  //
  // This is FAST because there is:
  // - NO RAWG request
  // - NO Firestore request
  //
  // It simply filters an existing array.
  // ==========================================================

  const filterGames = (
    games: any[],
    genres = selectedGenres,
    tags = selectedTags,
    platforms = selectedPlatforms
  ) => {
    return games.filter(
      (game) => {
        if (filterSexualContentRef.current && isSexualContentGame(game)) return false;
        const gameGenres = getGameGenres(game).map((name) => name.toLowerCase());
        const gameTags = getNameList(game.tags).map((name) => name.toLowerCase());
        const gamePlatforms = getNameList(game.platforms).map((name) => name.toLowerCase());

        // Selected genres use AND matching.
        //
        // Action + RPG means the game must
        // contain BOTH Action AND RPG.

        const matchesGenres =
          genres.length === 0 ||
          genres.every(
            (genre) =>
              gameGenres.includes(genre.trim().toLowerCase())
          );

        // Multiplayer + Co-op means
        // both tags must exist.

        const matchesTags =
          tags.length === 0 ||
          tags.every(
            (tag) =>
              gameTags.includes(tag.trim().toLowerCase())
          );

        // PC + PlayStation means
        // game must exist on both.

        const matchesPlatforms =
          platforms.length === 0 ||
          platforms.every(
            (platform) =>
              gamePlatforms.includes(platform.trim().toLowerCase())
          );

        return (
          matchesGenres &&
          matchesTags &&
          matchesPlatforms
        );
      }
    );
  };

  // ==========================================================
  // FETCH HOME GAMES
  // ==========================================================

  const fetchGames = async (
    pageNum: number,
    initial = false
  ) => {
    setLoading(true);
    if (initial) setCatalogError(null);

    try {
      const apiKey =
        process.env.EXPO_PUBLIC_RAWG_API_KEY;

      if (!apiKey) {
        if (initial) setCatalogError("Game catalog needs EXPO_PUBLIC_RAWG_API_KEY in your local .env file.");
        console.error(
          "RAWG API key missing"
        );

        return;
      }

      let data: any = null;
      let lastRequestError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          data = await requestJson<any>(
            `https://api.rawg.io/api/games?key=${apiKey}&page=${pageNum}&page_size=24&ordering=-rating`,
            15000,
          );
          break;
        } catch (error) {
          lastRequestError = error;
          const status = error instanceof HttpJsonError ? error.status : undefined;
          if (status === undefined || status < 500 || attempt === 1) throw error;
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }

      if (data === null) throw lastRequestError instanceof Error ? lastRequestError : new Error("RAWG request failed.");
      if (initial) setCatalogError(null);

      const formatted =
        (
          data.results || []
        ).map(
          formatRawgGame
        );

      const combined =
        initial
          ? formatted
          : [
              ...allGames,
              ...formatted,
            ];

      // Remove duplicates by RAWG ID

      const uniqueGames =
        Array.from(
          new Map(
            combined.map(
              (game: any) => [
                game.id.toString(),
                game,
              ]
            )
          ).values()
        ) as any[];

      const existingIds = new Set(allGames.map((game) => String(game.id)));
      const newlyFetched = uniqueGames.filter((game: any) => !existingIds.has(String(game.id)));
      const recommendedGames = initial
        ? randomizeGames(uniqueGames, preferredCategoriesRef.current, discoveryState.current)
        : [
            ...allGames,
            ...randomizeGames(newlyFetched, preferredCategoriesRef.current, discoveryState.current),
          ];
      if (initial && !hasRecordedDiscovery.current) {
        hasRecordedDiscovery.current = true;
        discoveryState.current = updateDiscoverySignals(discoveryState.current, recommendedGames.slice(0, 12));
        AsyncStorage.setItem(DISCOVERY_KEY, JSON.stringify(discoveryState.current)).catch(() => {});
      }
      setAllGames(recommendedGames);
      allGamesRef.current = recommendedGames;

      // Only modify visible home results
      // if user isn't currently searching.

      if (
        search.trim() === ""
      ) {
        const filtered =
          filterGames(
            recommendedGames
          );

        setFilteredGames(
          filtered
        );
      }

      // Keep first 100 locally

      const cache =
        uniqueGames.slice(
          0,
          100
        );

      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify(
          cache
        )
      );

      // Fire-and-forget Firestore caching.
      // Don't make Home wait for this.

      saveToGlobalCache(
        formatted
      );
    } catch (error) {
      if (initial) setCatalogError(error instanceof Error ? error.message : "Could not load the game catalog. Check your connection and RAWG API settings.");
      // Keep cached games and the inline catalog message; avoid a second
      // native LogBox error while another screen is in use.
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // SEARCH INPUT
  // ==========================================================

  const handleSearch = (
    text: string
  ) => {
    setSearch(text);

    if (
      searchTimeout.current
    ) {
      clearTimeout(
        searchTimeout.current
      );
    }

    const normalized =
      text.trim();

    // ========================================================
    // EMPTY SEARCH
    // ========================================================

    if (
      normalized.length === 0
    ) {
      // Invalidate older API requests

      searchRequestId.current++;

      setSearchResults([]);

      // Apply filters instantly
      // against home games

      setFilteredGames(
        filterGames(
          allGames
        )
      );

      setLoading(false);

      return;
    }

    // ========================================================
    // 1-2 CHARACTER SEARCH
    //
    // Search locally only.
    // Don't waste API requests.
    // ========================================================

    if (
      normalized.length < 3
    ) {
      searchRequestId.current++;

      const localResults =
        allGames.filter(
          (game) =>
            game.title
              ?.toLowerCase()
              .includes(
                normalized.toLowerCase()
              )
        );

      setFilteredGames(
        filterGames(
          localResults
        )
      );

      setLoading(false);

      return;
    }

    // ========================================================
    // DEBOUNCE API SEARCH
    // ========================================================

    searchTimeout.current =
      setTimeout(
        () => {
          performSearch(
            normalized
          );
        },
        400
      );
  };

  // ==========================================================
  // SEARCH FIRESTORE + RAWG
  //
  // IMPORTANT:
  //
  // Network search happens ONLY when search text changes.
  //
  // Changing filters DOES NOT call this function.
  // ==========================================================

  const performSearch = async (
    searchText: string
  ) => {
    const requestId =
      ++searchRequestId.current;

    setLoading(true);

    try {
      const catalogSearchText = removePlatformSuffix(searchText).trim();
      const normalized =
        catalogSearchText
          .trim()
          .toLowerCase();

      // ======================================================
      // FIRESTORE SEARCH
      // ======================================================

      let firestoreGames:
        any[] = [];

      try {
        const q = query(
          collection(
            db,
            "global_games"
          ),

          where(
            "searchName",
            ">=",
            normalized
          ),

          where(
            "searchName",
            "<=",
            normalized +
              "\uf8ff"
          ),

          limit(40)
        );

        const snapshot =
          await getDocs(q);

        firestoreGames =
          snapshot.docs.map(
            (document) =>
              document.data()
          );
      } catch (error) {
        console.error(
          "Firestore Search Error:",
          error
        );
      }

      // ======================================================
      // RAWG SEARCH
      // ======================================================

      let rawgGames:
        any[] = [];

      const apiKey =
        process.env.EXPO_PUBLIC_RAWG_API_KEY;

      if (apiKey) {
        try {
          const data = await requestJson<any>(
            `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(catalogSearchText)}&page_size=40`,
            15000,
          );

          rawgGames =
            (
              data.results || []
            ).map(
              formatRawgGame
            );
        } catch (error) {
          console.error(
            "RAWG Search Error:",
            error
          );
        }
      }

      // ======================================================
      // IGNORE OLD SEARCH REQUEST
      // ======================================================

      if (
        requestId !==
        searchRequestId.current
      ) {
        return;
      }

      // ======================================================
      // MERGE
      // ======================================================

      const merged = [
        ...firestoreGames,
        ...rawgGames,
      ];

      // ======================================================
      // REMOVE DUPLICATES
      // ======================================================

      const unique =
        Array.from(
          new Map(
            merged.map(
              (game) => [
                game.id.toString(),
                game,
              ]
            )
          ).values()
        );

      // ======================================================
      // SORT SEARCH RESULTS
      // ======================================================

      const getScore = (
        title: string
      ) => {
        const value =
          title
            .toLowerCase()
            .trim();

        if (
          value === normalized
        ) {
          return 0;
        }

        if (
          value.startsWith(
            normalized
          )
        ) {
          return 1;
        }

        if (
          value.includes(
            normalized
          )
        ) {
          return 2;
        }

        const words =
          normalized.split(
            /\s+/
          );

        const matchingWords =
          words.filter(
            (word) =>
              value.includes(
                word
              )
          ).length;

        if (
          matchingWords ===
          words.length
        ) {
          return 3;
        }

        if (
          matchingWords > 0
        ) {
          return 4;
        }

        return 5;
      };

      unique.sort(
        (
          a: any,
          b: any
        ) =>
          getScore(
            a.title || ""
          ) -
          getScore(
            b.title || ""
          )
      );

      // ======================================================
      // STORE RAW SEARCH RESULTS
      //
      // These remain untouched by filters.
      // ======================================================

      setSearchResults(
        unique
      );

      // ======================================================
      // APPLY CURRENT FILTERS LOCALLY
      // ======================================================

      const filtered =
        filterGames(
          unique
        );

      setFilteredGames(
        filtered
      );

      // Cache RAWG results without
      // blocking visible search results.

      if (
        rawgGames.length > 0
      ) {
        saveToGlobalCache(
          rawgGames
        );
      }
    } catch (error) {
      console.error(
        "Search Error:",
        error
      );
    } finally {
      if (
        requestId ===
        searchRequestId.current
      ) {
        setLoading(false);
      }
    }
  };

  // ==========================================================
  // TOGGLE FILTER
  // ==========================================================

  const toggleSelection = (
    item: string,

    selected: string[],

    setter:
      React.Dispatch<
        React.SetStateAction<
          string[]
        >
      >
  ) => {
    if (
      selected.includes(
        item
      )
    ) {
      setter(
        selected.filter(
          (value) =>
            value !== item
        )
      );
    } else {
      setter([
        ...selected,
        item,
      ]);
    }
  };

  // ==========================================================
  // APPLY FILTERS
  //
  // FAST:
  //
  // NO RAWG request
  // NO Firestore request
  //
  // Only filters arrays already in memory.
  // ==========================================================

  const handleApplyFilters =
    () => {
      setFilterVisible(
        false
      );

      // If searching, filter stored search results.
      //
      // Otherwise filter Home games.

      const source =
        search
          .trim()
          .length >= 3
          ? searchResults
          : allGames;

      const filtered =
        filterGames(
          source
        );

      setFilteredGames(
        filtered
      );
    };

  // ==========================================================
  // CLEAR FILTERS
  // ==========================================================

  const clearFilters = () => {
    setSelectedGenres([]);

    setSelectedTags([]);

    setSelectedPlatforms([]);

    // Immediately show unfiltered source

    if (
      search
        .trim()
        .length >= 3
    ) {
      setFilteredGames(
        searchResults
      );
    } else {
      setFilteredGames(
        allGames
      );
    }
  };

  // ==========================================================
  // LOAD MORE
  // ==========================================================

  const handleLoadMore =
    () => {
      if (
        !loading &&
        search.trim() === ""
      ) {
        const nextPage =
          page + 1;

        setPage(
          nextPage
        );

        fetchGames(
          nextPage
        );
      }
    };

  const handleRefresh = async () => {
    if (loading || search.trim()) return;
    setRefreshing(true);
    hasRecordedDiscovery.current = false;
    // RAWG's paginated catalog is stable; pulling to refresh rotates to a
    // different page, then the preference ranker shuffles that fresh batch.
    let nextPage = Math.floor(Math.random() * 50) + 1;
    if (nextPage === page) nextPage = (nextPage % 50) + 1;
    setPage(nextPage);
    try {
      await fetchGames(nextPage, true);
    } finally {
      setRefreshing(false);
    }
  };

  // ==========================================================
  // QUICK ADD
  // ==========================================================

  const handleQuickAdd =
    async (
      game: any,
      status: string
    ) => {
      if (
        !auth.currentUser
      ) {
        return showAlert(
          "Login Required",
          "Log in to track games."
        );
      }

      try {
        await setDoc(
          doc(
            db,
            "users",
            auth.currentUser.uid,
            "gameStatus",
            game.id
          ),

          {
            status,

            title:
              game.title,

            thumbnail:
              game.thumbnail,

            updatedAt:
              serverTimestamp(),
          },

          {
            merge: true,
          }
        );

        showAlert(
          "Success",
          `${game.title} marked as ${status}.`
        );
      } catch (error) {
        console.error(
          "Quick Add Error:",
          error
        );
      }
    };

  // ==========================================================
  // GAME CARD
  // ==========================================================

  const renderGameItem = ({
    item,
    index = 0,
  }: {
    item: any;
    index?: number;
  }) => (
    <Animated.View
      {...(isWeb ? { className: "gh-game-card" } as any : {})}
      style={[styles.gameCard, { width: cardWidth, minWidth: cardWidth, maxWidth: cardWidth, flexBasis: cardWidth, flexGrow: 0, flexShrink: 0 }]}
      entering={FadeInUp.delay(Math.min(index, 6) * 18).duration(210).reduceMotion(ReduceMotion.System)}
    >
      <Pressable
        style={({ pressed }) => pressed ? styles.gameCardImagePressed : undefined}
        onPress={() =>
          router.push({
            pathname:
              "/details",

            params: {
              id:
                item.id,
            },
          })
        }
      >
        <Image
          source={{
            uri:
              item.thumbnail,
          }}
          style={[styles.thumbnail, { height: Math.round(cardWidth * 0.58) }]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      </Pressable>

      <View
        style={
          styles.gameInfo
        }
      >
        <Text
          style={[styles.gameTitle, isWeb && viewportWidth >= 768 && { fontSize: 14 }]}
          numberOfLines={
            1
          }
        >
          {item.title}
        </Text>

        <View
          style={
            styles.cardFooter
          }
        >
          <View
            style={
              styles.tag
            }
          >
            <Text
              style={
                styles.tagText
              }
            >
              {item.genre}
            </Text>
          </View>

          <View
            style={
              styles.quickActions
            }
          >
            <Pressable
              onPress={() =>
                handleQuickAdd(
                  item,
                  "Playing"
                )
              }
            >
              <Ionicons
                name="game-controller-outline"
                size={16}
                color={themeColors.accentText}
              />
            </Pressable>

            <Pressable
              onPress={() =>
                handleQuickAdd(
                  item,
                  "Completed"
                )
              }
            >
              <Ionicons
                name="checkmark-done"
                size={16}
                color={themeColors.success}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  // ==========================================================
  // FILTER CHIP
  // ==========================================================

  const renderChip = (
    item: string,

    selected: string[],

    setter:
      React.Dispatch<
        React.SetStateAction<
          string[]
        >
      >
  ) => {
    const active =
      selected.includes(
        item
      );

    return (
      <Pressable
        key={
          item
        }

        onPress={() =>
          toggleSelection(
            item,
            selected,
            setter
          )
        }

        style={[
          styles.filterChip,

          active &&
            styles.filterChipActive,
        ]}
      >
        {active && (
          <Ionicons
            name="checkmark"
            size={14}
            color={themeColors.onAccent}
          />
        )}

        <Text
          style={[
            styles.filterChipText,

            active &&
              styles.filterChipTextActive,
          ]}
        >
          {item}
        </Text>
      </Pressable>
    );
  };

  // ==========================================================
  // FILTER COUNT
  // ==========================================================

  const activeFilterCount =
    selectedGenres.length +
    selectedTags.length +
    selectedPlatforms.length;

  const isStorefront = isWeb && !search.trim() && activeFilterCount === 0;
  const storefrontGames = filteredGames.length > 1 ? filteredGames.slice(1) : filteredGames;
  const extraGenres = [...new Set(storefrontGames.flatMap(getGameGenres))].filter((genre) =>
    !STOREFRONT_GENRES.some((knownGenre) => knownGenre.toLowerCase() === genre.toLowerCase()) &&
    storefrontGames.filter((game) => getGameGenres(game).some((name) => name.toLowerCase() === genre.toLowerCase())).length > 1
  );
  const storeSections = [...STOREFRONT_GENRES, ...extraGenres].map((genre) => ({
    genre,
    games: storefrontGames.filter((game) => getGameGenres(game).some((name) =>
      name.toLowerCase() === genre.toLowerCase() || name.toLowerCase().includes(genre.toLowerCase())
    )),
  })).filter((section) => section.games.length > 0);
  const categorizedGameIds = new Set(storeSections.flatMap((section) => section.games.map((game) => String(game.id))));
  const uncategorizedGames = storefrontGames.filter((game) => !categorizedGameIds.has(String(game.id)));
  if (uncategorizedGames.length > 0) storeSections.push({ genre: "More to explore", games: uncategorizedGames });

  const showAllByGenre = (genre: string) => {
    setSearch("");
    setSearchResults([]);
    setSelectedGenres([genre]);
    setSelectedTags([]);
    setSelectedPlatforms([]);
    setFilteredGames(filterGames(allGames, [genre], [], []));
  };

  const renderFeaturedHero = () => (
    <Pressable
      {...(isWeb ? { className: "gh-featured-hero" } as any : {})}
      onPress={() => router.push({ pathname: "/details", params: { id: filteredGames[0].id } })}
      style={[styles.featuredHero, { height: Math.min(390, Math.max(250, viewportWidth * 0.23)) }]}
    >
      <Image source={{ uri: filteredGames[0].thumbnail }} style={StyleSheet.absoluteFillObject} contentFit="cover" cachePolicy="memory-disk" />
      <View style={[StyleSheet.absoluteFillObject, styles.featuredShade, { backgroundColor: "rgba(0,0,0,0.58)" }]} />
      <View style={styles.featuredCopy}>
        <Text style={[styles.featuredEyebrow, { color: "#f5c518" }]}>FEATURED GAME</Text>
        <Text style={[styles.featuredTitle, { color: "#fff" }]} numberOfLines={2}>{filteredGames[0].title}</Text>
        <Text style={[styles.featuredGenre, { color: "#eee" }]} numberOfLines={1}>{filteredGames[0].genre} · Picked for your discovery feed</Text>
        <View style={styles.featuredCta}><Text style={styles.featuredCtaText}>Explore game</Text><Ionicons name="arrow-forward" size={16} color="#111" /></View>
      </View>
    </Pressable>
  );

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <>
      <Head>
        <title>GamePal | Discover games</title>
        <meta
          name="description"
          content="Discover games, find free giveaways, and keep your game library organized."
        />
      </Head>
      <View
        {...(isWeb ? { className: "gh-page-enter" } as any : {})}
        style={
          styles.container
        }
      >
      <GamingBackdrop />
      {/* SEARCH */}

        <View style={[styles.searchHeader, isWeb && { width: "100%", maxWidth: 1480, alignSelf: "center", marginTop: viewportWidth >= 768 ? 28 : 20, paddingHorizontal: viewportWidth >= 768 ? 28 : 16 }]}>
          <View style={styles.homeBrandHeader}>
            <Image
              source={require("@/assets/gamepal/logo-pack/png/gamepal-logo-color-transparent-1024.png")}
              contentFit="contain"
              accessibilityLabel="GamePal logo"
              style={styles.homeBrandLogo}
            />
            <View style={styles.homeBrandCopy}>
              <Text style={[styles.homeBrandTitle, { color: colors.text, fontSize: isWeb && viewportWidth >= 768 ? 29 : 21 }]}>Discover games</Text>
              <Text style={[styles.homeBrandSubtitle, { color: colors.textSecondary }]}>Find your next favorite game.</Text>
            </View>
          </View>
        <View
          style={
            styles.searchRow
          }
        >
          <View
            style={
              styles.searchContainer
            }
          >
            <Ionicons
              name="search"
              size={20}
              color={themeColors.muted}
            />

            <TextInput
              style={
                styles.searchInput
              }
              placeholder="Search games..."
              placeholderTextColor={themeColors.muted}
              value={
                search
              }
              onChangeText={
                handleSearch
              }
              autoCorrect={
                false
              }
            />
          </View>

          {isWeb && (
            <Pressable {...(isWeb ? { className: "gh-motion-button" } as any : {})} style={styles.filterButton} onPress={() => void handleRefresh()} accessibilityRole="button" accessibilityLabel="Refresh game recommendations">
              <Ionicons name="refresh-outline" size={21} color={themeColors.accentText} />
            </Pressable>
          )}

          {/* FILTER BUTTON */}

          {!desktopSidebar && <Pressable
            {...(isWeb ? { className: "gh-motion-button" } as any : {})}
            style={styles.filterButton}
            onPress={() => setFilterVisible(true)}
          >
            <Ionicons
              name="options-outline"
              size={22}
              color={themeColors.accentText}
            />

            {activeFilterCount >
              0 && (
              <View
                style={
                  styles.filterBadge
                }
              >
                <Text
                  style={
                    styles.filterBadgeText
                  }
                >
                  {
                    activeFilterCount
                  }
                </Text>
              </View>
            )}
          </Pressable>}
        </View>
      </View>

      {/* GAME LIST */}

      <View style={[styles.browseLayout, desktopSidebar && { flexDirection: "row", gap: 24, maxWidth: 1480, alignSelf: "center", paddingHorizontal: 28 }]}>
      {desktopSidebar && (
        <View style={[styles.filterSidebar, { height: Math.max(320, viewportHeight - 280) }]}>
          <View style={styles.sidebarHeading}>
            <View>
              <Text style={styles.sidebarTitle}>Filters</Text>
              <Text style={styles.modalSubtitle}>Narrow your discovery</Text>
            </View>
            {activeFilterCount > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View>}
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Genres</Text>
            <View style={styles.chipContainer}>{GENRES.map((genre) => renderChip(genre, selectedGenres, setSelectedGenres))}</View>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.chipContainer}>{TAGS.map((tag) => renderChip(tag, selectedTags, setSelectedTags))}</View>
            <Text style={styles.sectionTitle}>Platforms</Text>
            <View style={styles.chipContainer}>{PLATFORMS.map((platform) => renderChip(platform, selectedPlatforms, setSelectedPlatforms))}</View>
          </ScrollView>
          <View style={styles.sidebarActions}>
            <Pressable style={styles.clearButton} onPress={clearFilters}><Text style={styles.clearButtonText}>Clear</Text></Pressable>
            <Pressable style={styles.applyButton} onPress={handleApplyFilters}><Text style={styles.applyButtonText}>Apply</Text></Pressable>
          </View>
        </View>
      )}

      {isStorefront ? (
        <ScrollView
          style={desktopSidebar ? { flex: 1, minWidth: 0 } : isWeb ? { width: "100%", maxWidth: 1480, alignSelf: "center" } : undefined}
          contentContainerStyle={{ paddingHorizontal: sidePadding, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {filteredGames.length > 0 && renderFeaturedHero()}
          {filteredGames.length === 0 && (
            <View style={styles.emptyContainer}>
              {loading ? <GamePalLoader size={100} label="Loading games" fullScreen={false} /> : <Text style={styles.emptyText}>{catalogError || "No games are available right now."}</Text>}
            </View>
          )}
          {storeSections.map((section) => (
            <View key={section.genre} style={styles.storeSection}>
              <View style={styles.storeSectionHeader}>
                <View>
                  <Text style={styles.storeSectionTitle}>{section.genre} games</Text>
                  <Text style={styles.storeSectionSubtitle}>Explore picks from this genre</Text>
                </View>
                {section.genre !== "More to explore" && (
                  <Pressable {...(isWeb ? { className: "gh-motion-button" } as any : {})} onPress={() => showAllByGenre(section.genre)} style={styles.viewAllButton} accessibilityRole="button" accessibilityLabel={`View all ${section.genre} games`}>
                    <Text style={styles.viewAllText}>View all</Text>
                    <Ionicons name="arrow-forward" size={15} color={themeColors.accentText} />
                  </Pressable>
                )}
              </View>
              <ScrollView
                horizontal
                nestedScrollEnabled
                style={styles.carousel}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
              >
                {section.games.map((game, index) => (
                  <View key={`${section.genre}-${game.id}`} style={{ width: cardWidth, minWidth: cardWidth, flexGrow: 0, flexShrink: 0 }}>
                    {renderGameItem({ item: game, index })}
                  </View>
                ))}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      ) : (
      <FlatList
        key={`games-grid-${columns}`}
        data={filteredGames}
        style={desktopSidebar ? { flex: 1, minWidth: 0 } : isWeb ? { width: "100%", maxWidth: 1480, alignSelf: "center" } : undefined}
        contentContainerStyle={{ paddingHorizontal: sidePadding, paddingBottom: 100 }}

        refreshing={refreshing}
        onRefresh={handleRefresh}

        keyExtractor={(
          item
        ) =>
          item.id.toString()
        }

        renderItem={
          renderGameItem
        }

        initialNumToRender={8}
        windowSize={5}
        maxToRenderPerBatch={8}

        numColumns={columns}

        columnWrapperStyle={[styles.row, { justifyContent: "flex-start", gap: 12, paddingHorizontal: 0 }]}

        onEndReached={
          handleLoadMore
        }

        onEndReachedThreshold={
          0.5
        }

        keyboardShouldPersistTaps="handled"

        ListEmptyComponent={
          !loading ? (
            <View
              style={
                styles.emptyContainer
              }
            >
              <Ionicons
                name="game-controller-outline"
                size={40}
              color={themeColors.muted}
              />

              <Text
                style={
                  styles.emptyText
                }
              >
                No games match these filters.
              </Text>
            </View>
          ) : null
        }

        ListFooterComponent={
          loading ? (
            <GamePalLoader size={92} label="Loading more games" fullScreen={false} />
          ) : null
        }
      />
      )}
      </View>

      {/* ===================================================== */}
      {/* FILTER MODAL */}
      {/* ===================================================== */}

      <Modal
        visible={
          filterVisible
        }

        animationType="slide"

        transparent={
          true
        }

        onRequestClose={() =>
          setFilterVisible(
            false
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.modalContainer
            }
          >
            {/* HEADER */}

            <View
              style={
                styles.modalHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Filter Games
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Combine genres, tags and platforms
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  setFilterVisible(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={26}
                  color={themeColors.text}
                />
              </Pressable>
            </View>

            {/* FILTER OPTIONS */}

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
            >
              {/* GENRES */}

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Genres
              </Text>

              <View
                style={
                  styles.chipContainer
                }
              >
                {GENRES.map(
                  (genre) =>
                    renderChip(
                      genre,
                      selectedGenres,
                      setSelectedGenres
                    )
                )}
              </View>

              {/* TAGS */}

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Tags
              </Text>

              <View
                style={
                  styles.chipContainer
                }
              >
                {TAGS.map(
                  (tag) =>
                    renderChip(
                      tag,
                      selectedTags,
                      setSelectedTags
                    )
                )}
              </View>

              {/* PLATFORMS */}

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Platforms
              </Text>

              <View
                style={
                  styles.chipContainer
                }
              >
                {PLATFORMS.map(
                  (platform) =>
                    renderChip(
                      platform,
                      selectedPlatforms,
                      setSelectedPlatforms
                    )
                )}
              </View>
            </ScrollView>

            {/* ACTIONS */}

            <View
              style={
                styles.modalActions
              }
            >
              <Pressable
                style={
                  styles.clearButton
                }

                onPress={
                  clearFilters
                }
              >
                <Text
                  style={
                    styles.clearButtonText
                  }
                >
                  Clear All
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.applyButton
                }

                onPress={
                  handleApplyFilters
                }
              >
                <Text
                  style={
                    styles.applyButtonText
                  }
                >
                  Apply Filters
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles =
  createThemedStyles({
    container: {
      flex: 1,
      backgroundColor:
        "#121212",
      paddingHorizontal: 10,
    },

    searchHeader: {
      marginTop: 28,
      marginBottom: 15,
      paddingHorizontal: 10,
    },
    homeBrandHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
    homeBrandLogo: { width: 82, height: 82 },
    homeBrandCopy: { flex: 1 },
    homeBrandTitle: { fontSize: 21, fontWeight: "900", letterSpacing: -0.3 },
    homeBrandSubtitle: { fontSize: 13, marginTop: 4 },
    browseLayout: { flex: 1, width: "100%" },
    filterSidebar: { width: 250, flexShrink: 0, backgroundColor: "#1e1e1e", borderWidth: 1, borderColor: "#333", borderRadius: 18, padding: 16, marginBottom: 24 },
    sidebarHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    sidebarTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
    sidebarActions: { flexDirection: "row", gap: 8, paddingTop: 14 },
    storeIntro: { marginBottom: 20 },
    storeTitle: { color: "#fff", fontSize: 30, fontWeight: "900" },
    storeSubtitle: { color: "#aaa", fontSize: 14, marginTop: 5 },
    storeSection: { marginBottom: 28 },
    carousel: { width: "100%", flexGrow: 0 },
    storeSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 },
    storeSectionTitle: { color: "#fff", fontSize: 21, fontWeight: "800" },
    storeSectionSubtitle: { color: "#999", fontSize: 12, marginTop: 4 },
    viewAllButton: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: "#444" },
    viewAllText: { color: "#f5c518", fontSize: 12, fontWeight: "800" },

    featuredHero: {
      position: "relative",
      overflow: "hidden",
      borderRadius: 22,
      marginBottom: 24,
      backgroundColor: "#1e1e1e",
      borderWidth: 1,
      borderColor: "#333",
    },

    featuredShade: { backgroundColor: "rgba(0,0,0,0.58)" },
    featuredCopy: { flex: 1, justifyContent: "flex-end", alignItems: "flex-start", padding: 30 },
    featuredEyebrow: { color: "#f5c518", fontSize: 12, fontWeight: "800", letterSpacing: 1.4, marginBottom: 8 },
    featuredTitle: { color: "#fff", fontSize: 34, lineHeight: 40, fontWeight: "900", maxWidth: 620 },
    featuredGenre: { color: "#eee", fontSize: 14, marginTop: 9, marginBottom: 18 },
    featuredCta: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#f5c518", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 17 },
    featuredCtaText: { color: "#111", fontSize: 13, fontWeight: "800" },

    searchRow: {
      flexDirection: "row",
      gap: 10,
    },

    searchContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        "#1e1e1e",
      borderRadius: 15,
      paddingHorizontal: 15,
      height: 50,
      borderWidth: 1,
      borderColor: "#333",
    },

    searchInput: {
      flex: 1,
      color: "#fff",
      marginLeft: 10,
      fontSize: 16,
    },

    filterButton: {
      width: 50,
      height: 50,
      backgroundColor:
        "#1e1e1e",
      borderRadius: 15,
      alignItems: "center",
      justifyContent:
        "center",
      borderWidth: 1,
      borderColor: "#333",
    },

    filterBadge: {
      position:
        "absolute",
      top: -5,
      right: -5,
      backgroundColor:
        "#f5c518",
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    filterBadgeText: {
      color: "#000",
      fontSize: 11,
      fontWeight:
        "bold",
    },

    row: {
      justifyContent:
        "space-between",
      paddingHorizontal: 5,
    },

    gameCard: {
      backgroundColor:
        "#1e1e1e",
      borderRadius: 15,
      marginBottom: 15,
      flex: 0.48,
      borderWidth: 1,
      borderColor:
        "#2a2a2a",
      overflow:
        "hidden",
    },

    gameCardImagePressed: {
      opacity: 0.82,
    },

    thumbnail: {
      width: "100%",
      height: 100,
    },

    gameInfo: {
      padding: 8,
    },

    gameTitle: {
      color: "#fff",
      fontSize: 12,
      fontWeight:
        "bold",
      marginBottom: 6,
    },

    cardFooter: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      alignItems:
        "center",
    },

    tag: {
      backgroundColor:
        "rgba(245,197,24,0.1)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },

    tagText: {
      color: "#f5c518",
      fontSize: 8,
      fontWeight:
        "bold",
    },

    quickActions: {
      flexDirection:
        "row",
      gap: 12,
    },

    emptyContainer: {
      alignItems:
        "center",
      justifyContent:
        "center",
      paddingTop: 80,
    },

    emptyText: {
      color: "#777",
      marginTop: 12,
      fontSize: 14,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor:
        "rgba(0,0,0,0.7)",
      justifyContent:
        "flex-end",
    },

    modalContainer: {
      backgroundColor:
        "#181818",
      height: "80%",
      borderTopLeftRadius:
        25,
      borderTopRightRadius:
        25,
      padding: 20,
    },

    modalHeader: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      alignItems:
        "center",
      marginBottom: 10,
    },

    modalTitle: {
      color: "#fff",
      fontSize: 22,
      fontWeight:
        "bold",
    },

    modalSubtitle: {
      color: "#777",
      fontSize: 12,
      marginTop: 3,
    },

    sectionTitle: {
      color: "#fff",
      fontSize: 16,
      fontWeight:
        "bold",
      marginTop: 20,
      marginBottom: 12,
    },

    chipContainer: {
      flexDirection:
        "row",
      flexWrap:
        "wrap",
      gap: 8,
    },

    filterChip: {
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor:
        "#252525",
      borderWidth: 1,
      borderColor: "#444",
    },

    filterChipActive: {
      backgroundColor:
        "#f5c518",
      borderColor:
        "#f5c518",
    },

    filterChipText: {
      color: "#bbb",
      fontSize: 12,
    },

    filterChipTextActive: {
      color: "#000",
      fontWeight:
        "bold",
    },

    modalActions: {
      flexDirection:
        "row",
      gap: 10,
      paddingTop: 15,
    },

    clearButton: {
      flex: 1,
      height: 50,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#555",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    clearButtonText: {
      color: "#fff",
      fontWeight:
        "bold",
    },

    applyButton: {
      flex: 2,
      height: 50,
      borderRadius: 12,
      backgroundColor:
        "#f5c518",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    applyButtonText: {
      color: "#000",
      fontWeight:
        "bold",
    },
  });
