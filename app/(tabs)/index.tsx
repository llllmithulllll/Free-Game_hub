import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Head from "expo-router/head";
import { useRouter } from "expo-router";
import { isSexualContentGame, shouldFilterSexualContent } from "@/lib/content-filter";
import { randomizeGames, type DiscoveryState, updateDiscoverySignals } from "@/lib/recommendations";
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
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
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

// ============================================================
// HOME
// ============================================================

export default function Home() {
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
    let categories: string[] = [];
    let filter = true;
    try {
      const savedDiscovery = await AsyncStorage.getItem(DISCOVERY_KEY);
      if (savedDiscovery) discoveryState.current = JSON.parse(savedDiscovery);
    } catch (error) {
      console.error("Discovery state load error:", error);
    }

    const user = auth.currentUser;
    if (user) {
      try {
        const [profileSnap, preferencesSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "users", user.uid, "preferences", "data")),
        ]);
        const profile = profileSnap.exists() ? profileSnap.data() : {};
        const preferences = preferencesSnap.exists() ? preferencesSnap.data() : {};
        categories = preferences.categories || [];
        filter = shouldFilterSexualContent(profile.dateOfBirth, preferences.sexualContentFilter);
      } catch (error) {
        console.error("Content preference load error; using safe filter defaults:", error);
      }
    }
    preferredCategoriesRef.current = categories;
    filterSexualContentRef.current = filter;

    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);

      if (cached) {
        const parsed = JSON.parse(cached);
        const randomized = randomizeGames(parsed, categories, discoveryState.current);
        allGamesRef.current = randomized;
        setAllGames(randomized);
        setFilteredGames(filter ? randomized.filter((game: any) => !isSexualContentGame(game)) : randomized);
      }
    } catch (error) {
      console.error("Cache Error:", error);

      await AsyncStorage.removeItem(CACHE_KEY);
    }

    fetchGames(1, true);
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
        const gameGenres =
          game.genres ||
          (game.genre
            ? [game.genre]
            : []);

        const gameTags =
          game.tags || [];

        const gamePlatforms =
          game.platforms || [];

        // Selected genres use AND matching.
        //
        // Action + RPG means the game must
        // contain BOTH Action AND RPG.

        const matchesGenres =
          genres.length === 0 ||
          genres.every(
            (genre) =>
              gameGenres.includes(
                genre
              )
          );

        // Multiplayer + Co-op means
        // both tags must exist.

        const matchesTags =
          tags.length === 0 ||
          tags.every(
            (tag) =>
              gameTags.includes(
                tag
              )
          );

        // PC + PlayStation means
        // game must exist on both.

        const matchesPlatforms =
          platforms.length === 0 ||
          platforms.every(
            (platform) =>
              gamePlatforms.includes(
                platform
              )
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

    try {
      const apiKey =
        process.env.EXPO_PUBLIC_RAWG_API_KEY;

      if (!apiKey) {
        console.error(
          "RAWG API key missing"
        );

        return;
      }

      const response =
        await fetch(
          `https://api.rawg.io/api/games?key=${apiKey}&page=${pageNum}&page_size=40&ordering=-rating`
        );

      if (!response.ok) {
        throw new Error(
          `RAWG error: ${response.status}`
        );
      }

      const data =
        await response.json();

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
      console.error(
        "Fetch Error:",
        error
      );
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
      const normalized =
        searchText
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
          const response =
            await fetch(
              `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(
                searchText
              )}&page_size=40`
            );

          if (!response.ok) {
            throw new Error(
              `RAWG search error: ${response.status}`
            );
          }

          const data =
            await response.json();

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
        return Alert.alert(
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

        Alert.alert(
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
      style={styles.gameCard}
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
          style={
            styles.thumbnail
          }
        />
      </Pressable>

      <View
        style={
          styles.gameInfo
        }
      >
        <Text
          style={
            styles.gameTitle
          }
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
                color="#f5c518"
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
                color="#4CAF50"
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
            color="#000"
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

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <>
      <Head>
        <title>Free-Game Hub | Discover games</title>
        <meta
          name="description"
          content="Discover games, find free giveaways, and keep your game library organized."
        />
      </Head>
      <View
        style={
          styles.container
        }
      >
      {/* SEARCH */}

      <View
        style={
          styles.searchHeader
        }
      >
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
              color="#888"
            />

            <TextInput
              style={
                styles.searchInput
              }
              placeholder="Search games..."
              placeholderTextColor="#888"
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

          {/* FILTER BUTTON */}

          <Pressable
            style={
              styles.filterButton
            }

            onPress={() =>
              setFilterVisible(
                true
              )
            }
          >
            <Ionicons
              name="options-outline"
              size={22}
              color="#f5c518"
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
          </Pressable>
        </View>
      </View>

      {/* GAME LIST */}

      <FlatList
        data={
          filteredGames
        }

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

        numColumns={
          2
        }

        columnWrapperStyle={
          styles.row
        }

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
                color="#555"
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
            <ActivityIndicator
              color="#f5c518"
              style={{
                margin: 20,
              }}
            />
          ) : null
        }
      />

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
                  color="#fff"
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
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#121212",
      paddingHorizontal: 10,
    },

    searchHeader: {
      marginTop: 60,
      marginBottom: 15,
      paddingHorizontal: 10,
    },

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
