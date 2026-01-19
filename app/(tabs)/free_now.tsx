import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

/* ---------------- DROPDOWN ---------------- */
function Dropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);

  const selectedLabel =
    options.find((o) => o.value === value)?.label || "All";

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.filterLabel}>{label}</Text>

      <Pressable style={styles.dropdown} onPress={() => setOpen(true)}>
        <Text style={styles.dropdownText}>{selectedLabel}</Text>
      </Pressable>

      <Modal transparent visible={open} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={styles.modalBox}>
            {options.map((opt) => (
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

  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());

  const [platform, setPlatform] = useState("all");
  const [type, setType] = useState("all");
  const [sortBy, setSortBy] = useState("date");

  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    fetchGiveaways();
  }, [platform, type, sortBy]);

  useEffect(() => {
    loadClaimedGames();
  }, []);

  async function fetchGiveaways() {
    try {
      setLoading(true);

      let url = "https://gamerpower.com/api/giveaways";
      const params: string[] = [];

      if (platform !== "all") params.push(`platform=${platform}`);
      if (type !== "all") params.push(`type=${type}`);
      if (sortBy) params.push(`sort-by=${sortBy}`);

      if (params.length) url += "?" + params.join("&");

      const res = await fetch(url);
      const data = await res.json();
      setGiveaways(data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadClaimedGames() {
    const user = auth.currentUser;
    if (!user) return;

    const snap = await getDocs(
      collection(db, "users", user.uid, "claimedGames")
    );

    const ids = new Set<string>();
    snap.forEach((doc) => ids.add(doc.id));
    setClaimedIds(ids);
  }

  async function claimGiveaway(item: any) {
    const user = auth.currentUser;
    if (!user) return;

    const id = item.id.toString();
    if (claimedIds.has(id)) return;

    await setDoc(
      doc(db, "users", user.uid, "claimedGames", id),
      {
        title: item.title,
        platforms: item.platforms,
        thumbnail: item.thumbnail,
        description: item.description,
        giveawayUrl: item.open_giveaway_url,
        claimedAt: serverTimestamp(),
      }
    );

    setClaimedIds((prev) => new Set(prev).add(id));
  }

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
        <Text style={{ color: "#aaa", marginTop: 10 }}>
          Fetching giveaways...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* TOP BAR */}
      <View style={styles.topBar}>
        {/* FILTER BUTTON – LEFT */}
        <Pressable
          style={styles.filterBtn}
          onPress={() => setFiltersOpen((p) => !p)}
        >
          <Ionicons name="filter" size={20} color="#000" />
        </Pressable>

        {/* SEARCH – RIGHT */}
        <TextInput
          placeholder="Search giveaways..."
          placeholderTextColor="#777"
          value={search}
          onChangeText={setSearch}
          style={styles.search}
        />
      </View>

      {/* FILTERS */}
      {filtersOpen && (
        <View style={styles.filterBar}>
          <Dropdown
            label="Platform"
            value={platform}
            onChange={setPlatform}
            options={[
              { label: "All", value: "all" },
              { label: "PC", value: "pc" },
              { label: "Android", value: "android" },
              { label: "Steam", value: "steam" },
              { label: "Epic Games Store", value: "epic-games-store" },
              { label: "GOG", value: "gog" },
              { label: "PlayStation 4", value: "ps4" },
              { label: "Xbox One", value: "xbox-one" },
              { label: "Nintendo Switch", value: "nintendo-switch" },
              { label: "iOS", value: "ios" },
              { label: "Browser", value: "browser" },
            ]}
          />

          <Dropdown
            label="Type"
            value={type}
            onChange={setType}
            options={[
              { label: "All", value: "all" },
              { label: "Game", value: "game" },
              { label: "Loot", value: "loot" },
              { label: "Beta", value: "beta" },
            ]}
          />

          <Dropdown
            label="Sort By"
            value={sortBy}
            onChange={setSortBy}
            options={[
              { label: "Newest", value: "date" },
              { label: "Highest Value", value: "value" },
              { label: "Popularity", value: "popularity" },
            ]}
          />
        </View>
      )}

      {/* LIST */}
      <FlatList
        data={filteredGiveaways}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 10 }}
        renderItem={({ item }) => {
          const isClaimed = claimedIds.has(item.id.toString());

          return (
            <View style={styles.card}>
              <Image source={{ uri: item.thumbnail }} style={styles.image} />

              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>

                <Text style={styles.platform}>{item.platforms}</Text>

                <Text style={styles.desc} numberOfLines={2}>
                  {item.description}
                </Text>

                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  {isClaimed ? (
                    <View style={[styles.button, styles.claimed]}>
                      <Text style={styles.claimedText}>Claimed</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.button, { backgroundColor: "#2ecc71" }]}
                      onPress={() => claimGiveaway(item)}
                    >
                      <Text style={styles.buttonText}>Claim</Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={styles.button}
                    onPress={() => Linking.openURL(item.open_giveaway_url)}
                  >
                    <Text style={styles.buttonText}>Open</Text>
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

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 10,
  },

  search: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    color: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },

  filterBtn: {
    backgroundColor: "#f5c518",
    borderRadius: 10,
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  filterBar: {
    paddingHorizontal: 10,
    paddingBottom: 6,
  },

  filterLabel: {
    color: "#aaa",
    fontSize: 11,
    marginBottom: 4,
  },

  dropdown: {
    backgroundColor: "#1e1e1e",
    borderRadius: 8,
    padding: 12,
  },

  dropdownText: { color: "#fff", fontSize: 14 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalBox: {
    width: "85%",
    backgroundColor: "#1e1e1e",
    borderRadius: 10,
    paddingVertical: 8,
  },

  option: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },

  optionText: { color: "#fff" },

  card: {
    flexDirection: "row",
    backgroundColor: "#1e1e1e",
    borderRadius: 10,
    marginBottom: 12,
    padding: 10,
  },

  image: {
    width: 90,
    height: 90,
    borderRadius: 8,
    marginRight: 10,
  },

  title: { color: "#fff", fontWeight: "bold", fontSize: 14 },

  platform: {
    color: "#f5c518",
    fontSize: 11,
    marginVertical: 4,
  },

  desc: { color: "#ccc", fontSize: 11 },

  button: {
    backgroundColor: "#f5c518",
    paddingVertical: 6,
    borderRadius: 6,
    paddingHorizontal: 12,
  },

  buttonText: { color: "#000", fontWeight: "bold", fontSize: 12 },

  claimed: { backgroundColor: "#555" },

  claimedText: { color: "#ccc", fontWeight: "bold" },
});
