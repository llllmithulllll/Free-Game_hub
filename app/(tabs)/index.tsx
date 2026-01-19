import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const PAGE_SIZE = 20;

/* ------------------ DROPDOWN ------------------ */
function Dropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);

  const selectedLabel =
    options.find((o) => o.value === value)?.label || "Select";

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>

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

/* ------------------ MAIN SCREEN ------------------ */
export default function Index() {
  const router = useRouter();

  const [allGames, setAllGames] = useState<any[]>([]);
  const [page, setPage] = useState(1);

  const [platform, setPlatform] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    fetchGames();
  }, [platform, category]);

  async function fetchGames() {
    try {
      let url = "https://www.freetogame.com/api/games";
      const params = [];

      if (platform !== "all") params.push(`platform=${platform}`);
      if (category !== "all") params.push(`category=${category}`);

      if (params.length) url += "?" + params.join("&");

      const res = await fetch(url);
      const data = await res.json();

      setAllGames(data);
      setPage(1);
    } catch (e) {
      console.log(e);
    }
  }

  /* -------- SEARCH + PAGINATION -------- */
  const filteredGames = useMemo(() => {
    return allGames.filter((g) =>
      g.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [allGames, search]);

  const shownGames = filteredGames.slice(0, page * PAGE_SIZE);

  function loadMore() {
    if (shownGames.length >= filteredGames.length) return;
    setPage((p) => p + 1);
  }

  return (
    <View style={styles.root}>
      {/* TOP BAR */}
      <View style={styles.topBar}>
        <Pressable onPress={() => setFiltersOpen((p) => !p)}>
          <Ionicons name="menu" size={26} color="#fff" />
        </Pressable>

        <TextInput
          placeholder="Search games..."
          placeholderTextColor="#aaa"
          style={styles.search}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* FILTER PANEL (COLLAPSIBLE) */}
      {filtersOpen && (
        <View style={styles.filterPanel}>
          <Dropdown
            label="Platform"
            value={platform}
            onChange={setPlatform}
            options={[
              { label: "All", value: "all" },
              { label: "PC", value: "pc" },
              { label: "Browser", value: "browser" },
            ]}
          />

          <Dropdown
            label="Category"
            value={category}
            onChange={setCategory}
            options={[
              { label: "All", value: "all" },
              { label: "Action", value: "action" },
              { label: "Shooter", value: "shooter" },
              { label: "MMORPG", value: "mmorpg" },
              { label: "Strategy", value: "strategy" },
              { label: "Racing", value: "racing" },
              { label: "Sports", value: "sports" },
            ]}
          />
        </View>
      )}

      {/* GAME GRID */}
      <FlatList
        data={shownGames}
        numColumns={2}
        keyExtractor={(item) => item.id.toString()}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ padding: 8 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: "/details",
                params: { id: item.id },
              })
            }
          >
            <Image source={{ uri: item.thumbnail }} style={styles.image} />

            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>

            <Text style={styles.desc} numberOfLines={2}>
              {item.short_description}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

/* ------------------ STYLES ------------------ */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#121212",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },

  search: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 14,
  },

  filterPanel: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },

  label: {
    color: "#aaa",
    fontSize: 12,
    marginBottom: 4,
  },

  dropdown: {
    backgroundColor: "#1e1e1e",
    borderRadius: 8,
    padding: 12,
  },

  dropdownText: {
    color: "#fff",
    fontSize: 14,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalBox: {
    width: "80%",
    backgroundColor: "#1e1e1e",
    borderRadius: 10,
  },

  option: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },

  optionText: {
    color: "#fff",
    fontSize: 14,
  },

  card: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    margin: 6,
    borderRadius: 10,
    padding: 8,
  },

  image: {
    width: "100%",
    height: 100,
    borderRadius: 8,
  },

  title: {
    color: "#fff",
    fontWeight: "bold",
    marginTop: 6,
    fontSize: 13,
  },

  desc: {
    color: "#ccc",
    fontSize: 11,
    marginTop: 4,
  },
});
