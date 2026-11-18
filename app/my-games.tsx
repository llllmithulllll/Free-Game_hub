import { auth, db } from "@/lib/firebase";
import Animated, { FadeInUp, ReduceMotion } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";

type GameEntry = {
  id: string;
  title: string;
  thumbnail?: string | null;
  platforms?: string | string[];
  status: string;
};

const FILTERS = ["All", "Playing", "To Play", "Completed", "Claimed"];

export default function MyGames() {
  const router = useRouter();
  const [games, setGames] = useState<GameEntry[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }
    return onSnapshot(
      collection(db, "users", user.uid, "gameStatus"),
      (snapshot) => {
        const entries = snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            ...data,
            status: typeof data.status === "string" ? data.status : "To Play",
          } as GameEntry;
        });
        entries.sort((a, b) => a.title.localeCompare(b.title));
        setGames(entries);
        setLoading(false);
      },
      (error) => {
        console.error("Could not load game library:", error);
        setLoading(false);
        Alert.alert("Could not load games", "Check your connection and Firestore rules, then try again.");
      },
    );
  }, []);

  const visibleGames = useMemo(
    () => filter === "All" ? games : games.filter((game) => game.status === filter),
    [filter, games],
  );

  const moveGame = async (game: GameEntry, status: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "gameStatus", game.id), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Could not update game status:", error);
      Alert.alert("Could not update game", "Please try again.");
    }
  };

  const removeGame = (game: GameEntry) => {
    const user = auth.currentUser;
    if (!user) return;
    Alert.alert("Remove game", `Remove ${game.title} from My Games?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "users", user.uid, "gameStatus", game.id));
          } catch (error) {
            console.error("Could not remove game:", error);
            Alert.alert("Could not remove game", "Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Back to profile">
          <Ionicons name="arrow-back" size={22} color="#f5c518" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>My Games</Text>
          <Text style={styles.subtitle}>{games.length} saved across your library</Text>
        </View>
      </View>

      <FlatList
        horizontal
        style={styles.filterList}
        data={FILTERS}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        renderItem={({ item }) => (
          <Pressable onPress={() => setFilter(item)} style={[styles.filterChip, filter === item && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
            <Text style={[styles.filterCount, filter === item && styles.filterTextActive]}>
              {item === "All" ? games.length : games.filter((game) => game.status === item).length}
            </Text>
          </Pressable>
        )}
      />

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color="#f5c518" size="large" /></View>
      ) : (
        <FlatList
          data={visibleGames}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={filter === "All" ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="game-controller-outline" size={34} color="#f5c518" /></View>
              <Text style={styles.emptyTitle}>Your library starts here</Text>
              <Text style={styles.emptyDescription}>Save a game you’re playing, want to try, or find in Giveaways. It’ll appear here as a card.</Text>
              <View style={styles.emptyActions}>
                <Pressable style={styles.primaryButton} onPress={() => router.replace("/(tabs)")}>
                  <Ionicons name="search" size={16} color="#111" />
                  <Text style={styles.primaryButtonText}>Find games</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => router.replace("/free_now")}>
                  <Ionicons name="gift-outline" size={16} color="#f5c518" />
                  <Text style={styles.secondaryButtonText}>Giveaways</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.filteredEmpty}>
              <Ionicons name="albums-outline" size={26} color="#777" />
              <Text style={styles.filteredEmptyText}>No {filter.toLowerCase()} games yet.</Text>
              <Text style={styles.filteredEmptyHint}>Choose another status above to browse your library.</Text>
            </View>
          )}
          renderItem={({ item, index }) => (
            <Animated.View style={styles.cardContainer} entering={FadeInUp.delay(Math.min(index, 6) * 28).duration(220).reduceMotion(ReduceMotion.System)}>
              <View style={styles.gameCard}>
                <Pressable
                  style={styles.gameInfo}
                  onPress={() => router.push({ pathname: "/details", params: { id: item.id } })}
                >
                  {item.thumbnail ? (
                    <Image source={{ uri: item.thumbnail }} style={styles.image} />
                  ) : (
                    <View style={[styles.image, styles.imageFallback]}><Ionicons name="game-controller" size={26} color="#777" /></View>
                  )}
                  <View style={styles.gameText}>
                    <Text style={styles.gameTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.gamePlatform} numberOfLines={1}>
                      {Array.isArray(item.platforms) ? item.platforms.join(", ") : item.platforms || "Platform not listed"}
                    </Text>
                    <View style={styles.statusPill}><Text style={styles.statusText}>{item.status}</Text></View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#777" />
                </Pressable>
                <View style={styles.actions}>
                  <Action label="Playing" icon="play" onPress={() => void moveGame(item, "Playing")} />
                  <Action label="Done" icon="checkmark-done" onPress={() => void moveGame(item, "Completed")} />
                  <Action label="Later" icon="bookmark-outline" onPress={() => void moveGame(item, "To Play")} />
                  <Action label="Remove" icon="trash-outline" destructive onPress={() => removeGame(item)} />
                </View>
              </View>
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

function Action({ label, icon, destructive, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; destructive?: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <Ionicons name={icon} size={15} color={destructive ? "#ff6666" : "#f5c518"} />
      <Text style={[styles.actionText, destructive && styles.destructiveText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#121212" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 22, paddingBottom: 16, gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#1e1e1e", alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  title: { color: "#fff", fontSize: 25, fontWeight: "800" },
  subtitle: { color: "#888", fontSize: 12, marginTop: 3 },
  filterList: { flexGrow: 0, flexShrink: 0, height: 58 },
  filters: { paddingHorizontal: 16, paddingBottom: 12, alignItems: "center", gap: 8 },
  filterChip: { height: 40, flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: "#1e1e1e", borderWidth: 1, borderColor: "#303030" },
  filterChipActive: { backgroundColor: "#f5c518", borderColor: "#f5c518" },
  filterText: { color: "#bbb", fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: "#111" },
  filterCount: { color: "#888", fontSize: 10, fontWeight: "800" },
  list: { paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", alignSelf: "stretch", backgroundColor: "#1b1b1b", borderWidth: 1, borderColor: "#292929", borderRadius: 22, marginTop: 38, paddingHorizontal: 23, paddingVertical: 28 },
  emptyIcon: { width: 68, height: 68, borderRadius: 23, backgroundColor: "#2c2816", alignItems: "center", justifyContent: "center", marginBottom: 17 },
  emptyTitle: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center" },
  emptyDescription: { color: "#999", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 8, maxWidth: 290 },
  emptyActions: { flexDirection: "row", gap: 10, marginTop: 21, flexWrap: "wrap", justifyContent: "center" },
  primaryButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 13, backgroundColor: "#f5c518", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primaryButtonText: { color: "#111", fontSize: 13, fontWeight: "800" },
  secondaryButton: { minHeight: 44, paddingHorizontal: 15, borderRadius: 13, backgroundColor: "#292929", borderWidth: 1, borderColor: "#3a3a3a", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  secondaryButtonText: { color: "#f5c518", fontSize: 13, fontWeight: "700" },
  filteredEmpty: { alignItems: "center", padding: 24, marginTop: 22, gap: 8 },
  filteredEmptyText: { color: "#bbb", fontSize: 14, fontWeight: "700" },
  filteredEmptyHint: { color: "#777", fontSize: 12, textAlign: "center" },
  gameCard: { width: "100%", alignSelf: "stretch", backgroundColor: "#1b1b1b", borderRadius: 16, borderWidth: 1, borderColor: "#2a2a2a", marginBottom: 12, padding: 12 },
  cardContainer: { width: "100%" },
  gameInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  image: { width: 112, height: 112, borderRadius: 12, backgroundColor: "#282828" },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  gameText: { flex: 1, alignItems: "flex-start", gap: 5 },
  gameTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  gamePlatform: { color: "#999", fontSize: 11 },
  statusPill: { backgroundColor: "#2a2a2a", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 2 },
  statusText: { color: "#f5c518", fontSize: 10, fontWeight: "800" },
  actions: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#2b2b2b", marginTop: 10, paddingTop: 7 },
  action: { flex: 1, minHeight: 32, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4 },
  actionText: { color: "#bbb", fontSize: 10, fontWeight: "700" },
  destructiveText: { color: "#ff7777" },
});
