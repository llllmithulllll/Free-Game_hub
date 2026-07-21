import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

/* ---------------- DROPDOWN ---------------- */
function Dropdown({ label, value, options, onChange }: any) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o: any) => o.value === value)?.label || "All";

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.filterLabel}>{label}</Text>
      <Pressable style={styles.dropdown} onPress={() => setOpen(true)}>
        <Text style={styles.dropdownText}>{selectedLabel}</Text>
      </Pressable>
      <Modal transparent visible={open} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={styles.modalBox}>
            {options.map((opt: any) => (
              <Pressable
                key={opt.value}
                style={styles.option}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <Text style={styles.optionText}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ---------------- MAIN SCREEN ---------------- */
export default function FreeNow() {
  const [giveaways, setGiveaways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [type, setType] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    fetchGiveaways();
  }, [platform, type]);

  // Sync with the same collection used in Profile.tsx
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = collection(db, "users", user.uid, "gameStatus");
    const unsubscribe = onSnapshot(ref, (snap) => {
      const ids = new Set<string>();
      snap.forEach((doc) => {
        if (doc.data().status === "Claimed") {
          ids.add(doc.id);
        }
      });
      setClaimedIds(ids);
    });

    return () => unsubscribe();
  }, []);

  async function fetchGiveaways() {
    try {
      setLoading(true);
      setErrorMsg(null);

      // Use the canonical www. host — GamerPower's own docs always show
      // https://www.gamerpower.com/api/..., and the bare domain can behave
      // differently for TLS/redirects on a real device's native network
      // stack than it does in dev tooling.
      let url = "https://www.gamerpower.com/api/giveaways";
      const params: string[] = [];
      if (platform !== "all") params.push(`platform=${platform}`);
      if (type !== "all") params.push(`type=${type}`);
      if (params.length) url += "?" + params.join("&");

      const res = await fetch(url);

      if (!res.ok) {
        // Surfacing the actual HTTP status — previously this was
        // impossible to see in a release build since the catch block only
        // did console.log, which isn't visible without a debugger attached.
        throw new Error(`GamerPower API returned ${res.status}`);
      }

      const data = await res.json();

      // Defensive: handle either a bare array (the documented real shape)
      // or a { giveaways: [...] } wrapper, in case that ever changes.
      const list = Array.isArray(data) ? data : Array.isArray(data?.giveaways) ? data.giveaways : null;

      if (!list) {
        throw new Error("Unexpected response shape from GamerPower API");
      }

      setGiveaways(list);
    } catch (e: any) {
      console.error("Giveaways fetch error:", e?.message || e);
      setErrorMsg(e?.message || "Could not load giveaways. Check your connection.");
      setGiveaways([]);
    } finally {
      setLoading(false);
    }
  }

  async function claimGiveaway(item: any) {
    const user = auth.currentUser;
    if (!user) return Alert.alert("Error", "You must be logged in.");

    const id = item.id.toString();
    if (claimedIds.has(id)) return;

    try {
      const gameData = {
        title: item.title,
        thumbnail: item.thumbnail,
        status: "Claimed", // Unified Status
        platforms: item.platforms,
        giveawayUrl: item.open_giveaway_url,
        updatedAt: serverTimestamp(),
      };

      // 1. Save to User's Personal Profile (For Profile.tsx)
      await setDoc(doc(db, "users", user.uid, "gameStatus", id), gameData);

      // 2. Save to Global Backend Cache (For Index.tsx Speed)
      await setDoc(doc(db, "global_games", id), {
        ...gameData,
        searchName: item.title.toLowerCase(),
      }, { merge: true });

      Alert.alert("Success", "Game added to your Profile!");
    } catch (e) {
      Alert.alert("Error", "Could not save game.");
    }
  }

  const handleShare = async (item: any) => {
    try {
      await Share.share({
        message: `🔥 FREE GAME: ${item.title}\nClaim it here: ${item.open_giveaway_url}`,
      });
    } catch (error) {
      Alert.alert("Error", "Could not share.");
    }
  };

  const filteredGiveaways = useMemo(() => {
    if (!search.trim()) return giveaways;
    return giveaways.filter((g) =>
      g.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, giveaways]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f5c518" />
        <Text style={styles.loadingText}>Fetching Free Games...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.filterBtn} onPress={() => setFiltersOpen((p) => !p)}>
          <Ionicons name="filter" size={20} color="#000" />
        </Pressable>
        <TextInput
          placeholder="Search free games..."
          placeholderTextColor="#777"
          value={search}
          onChangeText={setSearch}
          style={styles.search}
        />
      </View>

      {errorMsg && (
        <Pressable style={styles.errorBanner} onPress={fetchGiveaways}>
          <Ionicons name="alert-circle" size={16} color="#ff4444" />
          <Text style={styles.errorText}>{errorMsg} — tap to retry</Text>
        </Pressable>
      )}

      {filtersOpen && (
        <View style={styles.filterBar}>
          <Dropdown 
            label="Platform" value={platform} onChange={setPlatform} 
            options={[{ label: "All", value: "all" }, { label: "PC", value: "pc" }, { label: "Steam", value: "steam" }, { label: "Epic Games", value: "epic-games-store" }]} 
          />
          <Dropdown 
            label="Type" value={type} onChange={setType} 
            options={[{ label: "All", value: "all" }, { label: "Full Game", value: "game" }, { label: "DLC/Loot", value: "loot" }]} 
          />
        </View>
      )}

      <FlatList
        data={filteredGiveaways}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          !errorMsg ? <Text style={styles.emptyText}>No giveaways match right now.</Text> : null
        }
        renderItem={({ item }) => {
          const isClaimed = claimedIds.has(item.id.toString());
          return (
            <View style={styles.card}>
              <Image source={{ uri: item.thumbnail }} style={styles.image} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.platform}>{item.platforms}</Text>
                
                <View style={styles.actionRow}>
                  {isClaimed ? (
                    <View style={[styles.button, styles.claimed]}>
                      <Ionicons name="checkmark-circle" size={14} color="#ccc" />
                      <Text style={[styles.buttonText, { color: '#ccc', marginLeft: 4 }]}>Claimed</Text>
                    </View>
                  ) : (
                    <Pressable style={[styles.button, { backgroundColor: "#2ecc71" }]} onPress={() => claimGiveaway(item)}>
                      <Text style={styles.buttonText}>Claim</Text>
                    </Pressable>
                  )}
                  
                  <Pressable style={styles.button} onPress={() => Linking.openURL(item.open_giveaway_url)}>
                    <Text style={styles.buttonText}>Open</Text>
                  </Pressable>

                  <Pressable style={[styles.button, styles.shareBtn]} onPress={() => handleShare(item)}>
                    <Ionicons name="share-social" size={16} color="#fff" />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#121212" },
  loadingText: { color: "#fff", marginTop: 15, fontSize: 14, fontWeight: "600" },
  topBar: { flexDirection: "row", alignItems: "center", padding: 15, gap: 10, marginTop: 40 },
  search: { flex: 1, backgroundColor: "#1e1e1e", color: "#fff", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#333' },
  filterBtn: { backgroundColor: "#f5c518", borderRadius: 10, padding: 12 },
  filterBar: { paddingHorizontal: 15, paddingBottom: 10 },
  filterLabel: { color: "#aaa", fontSize: 11, marginBottom: 4 },
  dropdown: { backgroundColor: "#1e1e1e", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#333' },
  dropdownText: { color: "#fff" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center" },
  modalBox: { width: "80%", backgroundColor: "#1e1e1e", borderRadius: 12, padding: 10 },
  option: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#333" },
  optionText: { color: "#fff", fontSize: 16 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#2a1414", marginHorizontal: 15, marginBottom: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#442020" },
  errorText: { color: "#ff8888", fontSize: 12, flex: 1 },
  emptyText: { color: "#666", textAlign: "center", marginTop: 40, fontSize: 13 },
  card: { flexDirection: "row", backgroundColor: "#1e1e1e", borderRadius: 12, marginBottom: 12, padding: 12, marginHorizontal: 15, borderWidth: 1, borderColor: '#2a2a2a' },
  image: { width: 85, height: 85, borderRadius: 8, marginRight: 12 },
  title: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  platform: { color: "#f5c518", fontSize: 11, marginVertical: 5 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  button: { backgroundColor: "#f5c518", paddingVertical: 8, borderRadius: 8, paddingHorizontal: 15, justifyContent: 'center', flexDirection: 'row', alignItems: 'center' },
  buttonText: { color: "#000", fontWeight: "bold", fontSize: 12 },
  claimed: { backgroundColor: "#333", borderWidth: 1, borderColor: '#444' },
  shareBtn: { backgroundColor: "#1e1e1e", borderWidth: 1, borderColor: "#444" },
});
