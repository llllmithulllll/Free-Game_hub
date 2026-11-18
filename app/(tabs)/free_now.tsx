import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform as NativePlatform } from "react-native";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  loadNotificationSettings,
  LocalNotificationSettings,
  requestLocalNotificationPermission,
  saveNotificationSettings,
  showLocalNotification,
} from "@/lib/local-notifications";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  Share,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { auth, db } from "@/lib/firebase";
import { isSexualContentGame, shouldFilterSexualContent } from "@/lib/content-filter";
import {
  collection,
  doc,
  getDoc,
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

async function fetchAlertGiveaways(selectedPlatform: string) {
  const url = selectedPlatform === "all"
    ? "https://www.gamerpower.com/api/giveaways"
    : `https://www.gamerpower.com/api/giveaways?platform=${encodeURIComponent(selectedPlatform)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GamerPower returned ${response.status}`);
  const data = await response.json();
  return Array.isArray(data) ? data : Array.isArray(data?.giveaways) ? data.giveaways : [];
}

async function seedGiveawayAlerts(selectedPlatform: string) {
  const list = await fetchAlertGiveaways(selectedPlatform);
  const key = `@gamehub_seen_giveaways_${selectedPlatform}`;
  await AsyncStorage.setItem(key, JSON.stringify(list.map((item: any) => String(item.id))));
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
  const [filterSexualContent, setFilterSexualContent] = useState(true);
  const [notificationSettings, setNotificationSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const [notificationOptionsVisible, setNotificationOptionsVisible] = useState(false);

  useEffect(() => {
    loadNotificationSettings().then(setNotificationSettings);
  }, []);

  useEffect(() => {
    const loadContentPreference = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const [profileSnap, preferencesSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "users", user.uid, "preferences", "data")),
        ]);
        setFilterSexualContent(shouldFilterSexualContent(
          profileSnap.exists() ? profileSnap.data().dateOfBirth : null,
          preferencesSnap.exists() ? preferencesSnap.data().sexualContentFilter : undefined,
        ));
      } catch (error) {
        console.error("Content preference load error:", error);
      }
    };
    loadContentPreference();
  }, []);

  useEffect(() => {
    fetchGiveaways();
  }, [platform, type]);

  useEffect(() => {
    if (!notificationSettings.giveawayAlerts || NativePlatform.OS === "web") return;
    let stopped = false;
    let scanning = false;
    const scan = async () => {
      if (stopped || scanning || AppState.currentState !== "active") return;
      scanning = true;
      const selectedPlatform = notificationSettings.giveawayPlatform;
      const key = `@gamehub_seen_giveaways_${selectedPlatform}`;
      try {
        const list = await fetchAlertGiveaways(selectedPlatform);
        if (stopped) return;
        const previousValue = await AsyncStorage.getItem(key);
        const previousIds = previousValue ? new Set<string>(JSON.parse(previousValue)) : null;
        const currentIds = list.map((item: any) => String(item.id));
        if (previousIds) {
          const fresh = list.filter((item: any) => !previousIds.has(String(item.id)));
          for (const item of fresh.slice(0, 3)) {
            await showLocalNotification(
              "New game giveaway",
              `${item.title} is free on ${item.platforms || "a supported platform"}.`,
              { url: "/free_now", giveawayId: String(item.id) },
            );
          }
        }
        await AsyncStorage.setItem(key, JSON.stringify(currentIds));
      } catch (error) {
        console.error("Giveaway alert check failed:", error);
      } finally {
        scanning = false;
      }
    };
    // The first result establishes a baseline; only later discoveries notify.
    void scan();
    const timer = setInterval(scan, 15 * 60 * 1000);
    const appStateListener = AppState.addEventListener("change", (state) => {
      if (state === "active") void scan();
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      appStateListener.remove();
    };
  }, [notificationSettings.giveawayAlerts, notificationSettings.giveawayPlatform]);

  const selectGiveawayAlertPlatform = async (selectedPlatform: string) => {
    setNotificationOptionsVisible(false);
    if (selectedPlatform === "off") {
      const next = { ...notificationSettings, giveawayAlerts: false };
      setNotificationSettings(next);
      await saveNotificationSettings(next);
      return;
    }
    const granted = await requestLocalNotificationPermission();
    if (!granted) {
      Alert.alert("Notifications are off", "Allow notifications in Android settings to get giveaway alerts.");
      return;
    }
    try {
      await seedGiveawayAlerts(selectedPlatform);
      const next: LocalNotificationSettings = {
        ...notificationSettings,
        giveawayAlerts: true,
        giveawayPlatform: selectedPlatform,
      };
      setNotificationSettings(next);
      await saveNotificationSettings(next);
      Alert.alert("Giveaway alerts enabled", selectedPlatform === "all"
        ? "You’ll be notified about new giveaways on any platform while the app is active."
        : `You’ll be notified about new ${selectedPlatform} giveaways while the app is active.`);
    } catch (error) {
      console.error("Could not enable giveaway alerts:", error);
      Alert.alert("Could not enable alerts", "The giveaway feed could not be reached. Try again when you are online.");
    }
  };

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
    return giveaways.filter((g) => {
      if (filterSexualContent && isSexualContentGame({ title: g.title })) return false;
      return !search.trim() || g.title.toLowerCase().includes(search.toLowerCase());
    });
  }, [search, giveaways, filterSexualContent]);

  const giveawaySections = useMemo(() => {
    const sections = [
      { title: "Games", type: "game" },
      { title: "DLC & Loot", type: "loot" },
      { title: "Other offers", type: "other" },
    ];
    return sections.map((section) => ({
      title: section.title,
      data: filteredGiveaways.filter((item) => {
        const itemType = String(item.type || "other").toLowerCase();
        return section.type === "other"
          ? itemType !== "game" && itemType !== "loot"
          : itemType === section.type;
      }),
    })).filter((section) => section.data.length > 0);
  }, [filteredGiveaways]);

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
        <Pressable style={styles.notificationBtn} onPress={() => setNotificationOptionsVisible(true)} accessibilityLabel="Giveaway notification settings">
          <Ionicons name={notificationSettings.giveawayAlerts ? "notifications" : "notifications-outline"} size={20} color={notificationSettings.giveawayAlerts ? "#111" : "#f5c518"} />
        </Pressable>
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

      <Modal transparent visible={notificationOptionsVisible} animationType="fade" onRequestClose={() => setNotificationOptionsVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setNotificationOptionsVisible(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.notificationTitle}>New giveaway alerts</Text>
            <Text style={styles.notificationSubtitle}>Choose which platform should trigger alerts.</Text>
            {[
              { label: "All platforms", value: "all" },
              { label: "PC", value: "pc" },
              { label: "Steam", value: "steam" },
              { label: "Epic Games Store", value: "epic-games-store" },
            ].map((option) => (
              <Pressable key={option.value} style={styles.option} onPress={() => void selectGiveawayAlertPlatform(option.value)}>
                <Text style={styles.optionText}>{option.label}</Text>
                {notificationSettings.giveawayAlerts && notificationSettings.giveawayPlatform === option.value && <Ionicons name="checkmark" size={18} color="#f5c518" />}
              </Pressable>
            ))}
            <Pressable style={styles.option} onPress={() => void selectGiveawayAlertPlatform("off")}>
              <Text style={styles.optionText}>Turn alerts off</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

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
            options={[{ label: "All categories", value: "all" }, { label: "Games", value: "game" }, { label: "DLC & Loot", value: "loot" }, { label: "Other offers", value: "beta" }]}
          />
        </View>
      )}

      <SectionList
        sections={giveawaySections}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 15 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.categoryHeading}>
            <Text style={styles.categoryHeadingText}>{section.title}</Text>
            <Text style={styles.categoryCount}>{section.data.length}</Text>
          </View>
        )}
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
  notificationBtn: { backgroundColor: "#262626", borderRadius: 10, padding: 12 },
  search: { flex: 1, backgroundColor: "#1e1e1e", color: "#fff", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#333' },
  filterBtn: { backgroundColor: "#f5c518", borderRadius: 10, padding: 12 },
  filterBar: { paddingHorizontal: 15, paddingBottom: 10 },
  filterLabel: { color: "#aaa", fontSize: 11, marginBottom: 4 },
  dropdown: { backgroundColor: "#1e1e1e", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#333' },
  dropdownText: { color: "#fff" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center" },
  modalBox: { width: "80%", backgroundColor: "#1e1e1e", borderRadius: 12, padding: 10 },
  notificationTitle: { color: "#fff", fontSize: 18, fontWeight: "800", paddingHorizontal: 12, paddingTop: 10 },
  notificationSubtitle: { color: "#aaa", fontSize: 12, lineHeight: 18, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  option: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#333" },
  optionText: { color: "#fff", fontSize: 16 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#2a1414", marginHorizontal: 15, marginBottom: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#442020" },
  errorText: { color: "#ff8888", fontSize: 12, flex: 1 },
  emptyText: { color: "#666", textAlign: "center", marginTop: 40, fontSize: 13 },
  categoryHeading: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, marginBottom: 9, paddingHorizontal: 2 },
  categoryHeadingText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  categoryCount: { color: "#111", backgroundColor: "#f5c518", borderRadius: 10, overflow: "hidden", minWidth: 22, textAlign: "center", paddingHorizontal: 6, paddingVertical: 2, fontSize: 11, fontWeight: "800" },
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
