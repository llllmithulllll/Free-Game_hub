import { auth, db } from "@/lib/firebase";
import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const PAGE_SIZE = 20;

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function Index() {
  const router = useRouter();
  const [allGames, setAllGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [preferences, setPreferences] = useState<any>(null);

  // ✅ Listen to Cloud Database Preferences
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const ref = doc(db, "users", user.uid, "preferences", "data");
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) setPreferences(snap.data());
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchGames();
  }, [preferences]);

  async function fetchGames() {
    try {
      setLoading(true);
      const res = await fetch("https://www.freetogame.com/api/games");
      const data = await res.json();

      if (!preferences?.categories || preferences.categories.length === 0) {
        setAllGames(shuffleArray(data));
        return;
      }

      // ✅ 60/40 Weaving Logic
      const preferred = shuffleArray(data.filter((g: any) => 
        preferences.categories.includes(g.genre?.toLowerCase())
      ));
      const others = shuffleArray(data.filter((g: any) => 
        !preferences.categories.includes(g.genre?.toLowerCase())
      ));

      const mixed: any[] = [];
      let pIdx = 0, oIdx = 0;
      // Pattern: P, O, P, O, P, P, O, P, O, P (60% Pref, 40% Other)
      const pattern = [true, false, true, false, true, true, false, true, false, true];

      for (let i = 0; i < data.length; i++) {
        const wantPref = pattern[i % 10];
        if (wantPref && pIdx < preferred.length) mixed.push(preferred[pIdx++]);
        else if (oIdx < others.length) mixed.push(others[oIdx++]);
        else if (pIdx < preferred.length) mixed.push(preferred[pIdx++]);
      }
      setAllGames(mixed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    return allGames.filter(g => g.title.toLowerCase().includes(search.toLowerCase()));
  }, [allGames, search]);

  if (loading) return <View style={styles.center}><ActivityIndicator color="#f5c518" size="large" /></View>;

  return (
    <View style={styles.root}>
      <TextInput 
        placeholder="Search..." placeholderTextColor="#aaa" 
        style={styles.search} value={search} onChangeText={setSearch} 
      />
      <FlatList
        data={filtered}
        numColumns={2}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push({ pathname: "/details", params: { id: item.id } })}>
            <Image source={{ uri: item.thumbnail }} style={styles.image} />
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.genre}>{item.genre}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#121212", padding: 10 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#121212" },
  search: { backgroundColor: "#1e1e1e", color: "#fff", padding: 12, borderRadius: 10, marginBottom: 10 },
  card: { flex: 1, backgroundColor: "#1e1e1e", margin: 5, borderRadius: 10, padding: 8 },
  image: { width: "100%", height: 100, borderRadius: 8 },
  title: { color: "#fff", fontWeight: "bold", fontSize: 13, marginTop: 5 },
  genre: { color: "#f5c518", fontSize: 11 }
});