import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const SEARCH_HISTORY_KEY = "@game_search_history";
const CACHE_KEY = "@cached_games_list";
const CATEGORIES = ["All", "Shooter", "MOBA", "Anime", "Racing", "Strategy", "Sports"];

export default function Home() {
  const [allGames, setAllGames] = useState<any[]>([]);
  const [filteredGames, setFilteredGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [history, setHistory] = useState<string[]>([]);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    initializeData();
    loadSearchHistory();
  }, []);

  // --- Caching & Data Fetching Logic ---
  const initializeData = async () => {
    try {
      setLoading(true);
      // 1. Check if we have cached games on the device
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsedData = JSON.parse(cached);
        setAllGames(parsedData);
        setFilteredGames(parsedData);
        setLoading(false);
        // Still fetch in background to keep data fresh, but don't show loader
        fetchGames(false); 
      } else {
        // 2. No cache, must fetch immediately
        await fetchGames(true);
      }
    } catch (e) {
      console.error("Cache Load Error", e);
      fetchGames(true);
    }
  };

  const fetchGames = async (showLoader: boolean) => {
    if (showLoader) setLoading(true);
    try {
      // ✅ Using HTTPS for production APK stability
      const response = await fetch("https://www.freetogame.com/api/games");
      const data = await response.json();
      
      // ✅ Update Cache for next launch
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
      
      setAllGames(data);
      applyFilters(search, selectedCategory, data);
    } catch (error) {
      console.error("API Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- Search History ---
  const loadSearchHistory = async () => {
    const saved = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    if (saved) setHistory(JSON.parse(saved));
  };

  const saveSearch = async (term: string) => {
    if (!term.trim()) return;
    const cleanTerm = term.trim().toLowerCase();
    const newHistory = [cleanTerm, ...history.filter((h) => h !== cleanTerm)].slice(0, 5);
    setHistory(newHistory);
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
  };

  // --- Filter & Search Logic ---
  const applyFilters = (searchText: string, category: string, data = allGames) => {
    let result = data;
    if (category !== "All") {
      result = result.filter((game) => game.genre.toLowerCase() === category.toLowerCase());
    }
    if (searchText.trim() !== "") {
      result = result.filter((game) =>
        game.title.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    setFilteredGames(result);
  };

  const renderGameItem = ({ item }: { item: any }) => (
    <Pressable 
      style={styles.gameCard} 
      onPress={() => router.push({ pathname: "/details", params: { id: item.id } })}
    >
      {/* ✅ Explicit Dimensions prevent thumbnails from disappearing in APK */}
      <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
      <View style={styles.gameInfo}>
        <Text style={styles.gameTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{item.genre}</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchHeader}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search games..."
            placeholderTextColor="#888"
            value={search}
            onChangeText={(text) => { setSearch(text); applyFilters(text, selectedCategory); }}
            onFocus={() => setIsHistoryVisible(true)}
            onSubmitEditing={() => { saveSearch(search); setIsHistoryVisible(false); Keyboard.dismiss(); }}
          />
        </View>
      </View>

      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => { setSelectedCategory(cat); applyFilters(search, cat); }}
              style={[styles.filterBtn, selectedCategory === cat && styles.filterBtnActive]}
            >
              <Text style={[styles.filterBtnText, selectedCategory === cat && styles.filterBtnTextActive]}>{cat}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading && allGames.length === 0 ? (
        <ActivityIndicator size="large" color="#f5c518" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredGames}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderGameItem}
          numColumns={2} // ✅ Two cards per row
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={() => fetchGames(true)} // ✅ Pull-to-refresh
          refreshing={loading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212", paddingHorizontal: 10 },
  searchHeader: { marginTop: 60, marginBottom: 15, paddingHorizontal: 10 },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#1e1e1e", borderRadius: 15, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: "#333" },
  searchInput: { flex: 1, color: "#fff", marginLeft: 10, fontSize: 16 },
  filterWrapper: { marginBottom: 20, paddingHorizontal: 10 },
  filterBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1e1e1e", marginRight: 10, borderWidth: 1, borderColor: "#333" },
  filterBtnActive: { backgroundColor: "#f5c518", borderColor: "#f5c518" },
  filterBtnText: { color: "#aaa", fontWeight: "bold", fontSize: 12 },
  filterBtnTextActive: { color: "#000" },
  row: { justifyContent: "space-between", paddingHorizontal: 5 },
  listContent: { paddingBottom: 120 },
  gameCard: {
    backgroundColor: "#1e1e1e",
    borderRadius: 15,
    marginBottom: 15,
    flex: 0.48, 
    borderWidth: 1,
    borderColor: "#2a2a2a",
    overflow: "hidden",
  },
  thumbnail: { width: "100%", height: 100 },
  gameInfo: { padding: 10 },
  gameTitle: { color: "#fff", fontSize: 13, fontWeight: "bold", marginBottom: 5 },
  tag: { backgroundColor: "rgba(245, 197, 24, 0.1)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  tagText: { color: "#f5c518", fontSize: 9, fontWeight: "bold" },
});