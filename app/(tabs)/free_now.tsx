import { Ionicons } from "@expo/vector-icons";
import GamePalLoader from "@/components/GamePalLoader";
import GamingBackdrop from "@/components/GamingBackdrop";
import { Image } from "expo-image";
import { createThemedStyles, themeColors, useAppTheme, useThemedAlert } from "@/lib/theme";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
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
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  SectionList,  Text,
  TextInput,
  View,
  Platform,
  useWindowDimensions,
} from "react-native";

import { auth, db } from "@/lib/firebase";
import { requestJson } from "@/lib/http-json";
import { isSexualContentGame, shouldFilterSexualContent } from "@/lib/content-filter";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const GIVEAWAYS_CACHE_KEY = "@gamehub_giveaways_cache_v1";
const GIVEAWAY_ALERT_PLATFORMS = [
  { label: "PC", value: "pc" },
  { label: "Steam", value: "steam" },
  { label: "Epic Games Store", value: "epic-games-store" },
  { label: "PlayStation", value: "ps4" },
  { label: "Xbox", value: "xbox-one" },
  { label: "Nintendo Switch", value: "switch" },
  { label: "GOG", value: "gog" },
  { label: "Ubisoft Connect", value: "ubisoft" },
];
const GIVEAWAY_ALERT_TYPES = [
  { label: "Games", value: "game" },
  { label: "DLC & loot", value: "loot" },
  { label: "Beta access", value: "beta" },
  { label: "Other offers", value: "other" },
];

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
  const data = await requestJson<any>(url, 12000);
  return Array.isArray(data) ? data : Array.isArray(data?.giveaways) ? data.giveaways : [];
}

async function seedGiveawayAlerts(selectedPlatform: string) {
  const list = await fetchAlertGiveaways(selectedPlatform);
  const key = `@gamehub_seen_giveaways_${selectedPlatform}`;
  await AsyncStorage.setItem(key, JSON.stringify(list.map((item: any) => String(item.id))));
}

function getGiveawayAlertType(item: any) {
  const value = String(item.type || "").toLowerCase();
  if (value.includes("game")) return "game";
  if (value.includes("loot") || value.includes("dlc")) return "loot";
  if (value.includes("beta")) return "beta";
  return "other";
}

/* ---------------- MAIN SCREEN ---------------- */
export default function FreeNow() {
  useAppTheme();
  const showAlert = useThemedAlert();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
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
  const [draftGiveawayPlatforms, setDraftGiveawayPlatforms] = useState<string[]>(["all"]);
  const [draftGiveawayTypes, setDraftGiveawayTypes] = useState<string[]>(["all"]);
  const giveawayRequestId = useRef(0);

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
    let cancelled = false;
    const requestId = ++giveawayRequestId.current;
    const cacheKey = `${GIVEAWAYS_CACHE_KEY}_${platform}_${type}`;
    setLoading(true);
    setErrorMsg(null);
    AsyncStorage.getItem(cacheKey).then((cached) => {
      if (!cancelled && requestId === giveawayRequestId.current && cached) setGiveaways(JSON.parse(cached));
    }).catch((error) => console.warn("Could not load cached giveaways:", error));
    fetchGiveaways(requestId).finally(() => {
      if (!cancelled && requestId === giveawayRequestId.current) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [platform, type]);

  useEffect(() => {
    if (!notificationSettings.giveawayAlerts || NativePlatform.OS === "web") return;
    let stopped = false;
    let scanning = false;
    const scan = async () => {
      if (stopped || scanning || AppState.currentState !== "active") return;
      scanning = true;
      const selectedPlatforms = notificationSettings.giveawayPlatforms.length ? notificationSettings.giveawayPlatforms : ["all"];
      const allItems: any[] = [];
      try {
        for (const selectedPlatform of selectedPlatforms) {
          const list = await fetchAlertGiveaways(selectedPlatform);
          if (stopped) return;
          const key = `@gamehub_seen_giveaways_${selectedPlatform}`;
          const previousValue = await AsyncStorage.getItem(key);
          const previousIds = previousValue ? new Set<string>(JSON.parse(previousValue)) : null;
          const currentIds = list.map((item: any) => String(item.id));
          if (previousIds) allItems.push(...list.filter((item: any) => !previousIds.has(String(item.id))));
          await AsyncStorage.setItem(key, JSON.stringify(currentIds));
        }
        const selectedTypes = notificationSettings.giveawayTypes.length ? notificationSettings.giveawayTypes : ["all"];
        const uniqueFresh = Array.from(new Map(allItems.map((item) => [String(item.id), item])).values())
          .filter((item: any) => selectedTypes.includes("all") || selectedTypes.includes(getGiveawayAlertType(item)));
        for (const item of uniqueFresh.slice(0, 3)) {
          await showLocalNotification(
            "New game giveaway",
            `${item.title} is free on ${item.platforms || "a supported platform"}.`,
            { url: "/free_now", giveawayId: String(item.id) },
          );
        }
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
  }, [notificationSettings.giveawayAlerts, notificationSettings.giveawayPlatforms.join(","), notificationSettings.giveawayTypes.join(",")]);

  const toggleMultiSelect = (selected: string, setValues: Dispatch<SetStateAction<string[]>>) => {
    setValues((current) => {
      if (selected === "all") return ["all"];
      const withoutAll = current.filter((value) => value !== "all");
      return withoutAll.includes(selected)
        ? withoutAll.filter((value) => value !== selected)
        : [...withoutAll, selected];
    });
  };

  const saveGiveawayAlertPlatforms = async () => {
    setNotificationOptionsVisible(false);
    const selectedPlatforms = draftGiveawayPlatforms.length ? draftGiveawayPlatforms : [];
    const selectedTypes = draftGiveawayTypes.length ? draftGiveawayTypes : [];
    if (!selectedPlatforms.length || !selectedTypes.length) {
      const next = { ...notificationSettings, giveawayAlerts: false };
      setNotificationSettings(next);
      await saveNotificationSettings(next);
      return;
    }
    const granted = await requestLocalNotificationPermission();
    if (!granted) {
      showAlert("Notifications are off", "Allow notifications in Android settings to get giveaway alerts.");
      return;
    }
    try {
      for (const selectedPlatform of selectedPlatforms) await seedGiveawayAlerts(selectedPlatform);
      const next: LocalNotificationSettings = {
        ...notificationSettings,
        giveawayAlerts: true,
        giveawayPlatforms: selectedPlatforms,
        giveawayTypes: selectedTypes,
      };
      setNotificationSettings(next);
      await saveNotificationSettings(next);
      showAlert("Giveaway alerts enabled", selectedPlatforms.includes("all")
        ? "You’ll be notified about new giveaways on any platform while the app is active."
        : `You’ll be notified about new offers on ${selectedPlatforms.map((value) => GIVEAWAY_ALERT_PLATFORMS.find((item) => item.value === value)?.label || value).join(", ")} while the app is active.`);
    } catch (error) {
      console.error("Could not enable giveaway alerts:", error);
      showAlert("Could not enable alerts", "The giveaway feed could not be reached. Try again when you are online.");
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

  async function fetchGiveaways(requestId = ++giveawayRequestId.current) {
    try {
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

      const data = await requestJson<any>(url, 12000);

      // Defensive: handle either a bare array (the documented real shape)
      // or a { giveaways: [...] } wrapper, in case that ever changes.
      const list = Array.isArray(data) ? data : Array.isArray(data?.giveaways) ? data.giveaways : null;

      if (!list) {
        throw new Error("Unexpected response shape from GamerPower API");
      }

      if (requestId === giveawayRequestId.current) setGiveaways(list);
      void AsyncStorage.setItem(`${GIVEAWAYS_CACHE_KEY}_${platform}_${type}`, JSON.stringify(list));
    } catch (e: any) {
      const message = e?.message || "Could not load giveaways. Check your connection.";
      console.error("Giveaways fetch error:", message);
      if (requestId === giveawayRequestId.current) setErrorMsg(message);
    }
  }

  async function claimGiveaway(item: any) {
    const user = auth.currentUser;
    if (!user) return showAlert("Error", "You must be logged in.");

    const id = item.id.toString();
    if (claimedIds.has(id)) return;

    try {
      const gameData = {
        title: item.title,
        thumbnail: item.thumbnail,
        status: "Claimed", // Unified Status
        platforms: item.platforms,
        giveawayUrl: item.open_giveaway_url,
        giveawayType: ["game", "loot", "beta"].includes(String(item.type || "").toLowerCase())
          ? String(item.type).toLowerCase()
          : "other",
        updatedAt: serverTimestamp(),
      };

      // 1. Save to User's Personal Profile (For Profile.tsx)
      await setDoc(doc(db, "users", user.uid, "gameStatus", id), gameData);

      showAlert("Success", "Game added to your Profile!");
    } catch (e) {
      showAlert("Error", "Could not save game.");
    }
  }

  const handleShare = async (item: any) => {
    try {
      await Share.share({
        message: `🔥 FREE GAME: ${item.title}\nClaim it here: ${item.open_giveaway_url}`,
      });
    } catch (error) {
      showAlert("Error", "Could not share.");
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

  return (
    <View style={styles.container}>
      <GamingBackdrop />
      <View style={[styles.topBar, isWeb && { width: "100%", maxWidth: 1160, alignSelf: "center", marginTop: width >= 768 ? 28 : 20, paddingHorizontal: width >= 768 ? 28 : 16 }]}>
        <Pressable style={styles.notificationBtn} onPress={() => { setDraftGiveawayPlatforms(notificationSettings.giveawayPlatforms); setDraftGiveawayTypes(notificationSettings.giveawayTypes); setNotificationOptionsVisible(true); }} accessibilityLabel="Giveaway notification settings">
          <Ionicons name={notificationSettings.giveawayAlerts ? "notifications" : "notifications-outline"} size={20} color={notificationSettings.giveawayAlerts ? themeColors.onAccent : themeColors.accentText} />
        </Pressable>
        <Pressable style={styles.filterBtn} onPress={() => setFiltersOpen((p) => !p)}>
          <Ionicons name="filter" size={20} color={themeColors.onAccent} />
        </Pressable>
        <TextInput
          placeholder="Search free games..."
          placeholderTextColor={themeColors.muted}
          value={search}
          onChangeText={setSearch}
          style={styles.search}
        />
      </View>

      <Modal transparent visible={notificationOptionsVisible} animationType="fade" onRequestClose={() => setNotificationOptionsVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setNotificationOptionsVisible(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.notificationTitle}>New giveaway alerts</Text>
            <Text style={styles.notificationSubtitle}>Choose several platforms and offer types. Alerts are checked while the app is open.</Text>
            <ScrollView style={{ maxHeight: 430 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.notificationGroupTitle}>Platforms</Text>
              {[{ label: "All platforms", value: "all" }, ...GIVEAWAY_ALERT_PLATFORMS].map((option) => (
                <Pressable key={option.value} style={styles.option} onPress={() => toggleMultiSelect(option.value, setDraftGiveawayPlatforms)}>
                  <Text style={styles.optionText}>{option.label}</Text>
                  {draftGiveawayPlatforms.includes(option.value) && <Ionicons name="checkmark-circle" size={19} color={themeColors.accentText} />}
                </Pressable>
              ))}
              <Text style={styles.notificationGroupTitle}>Offer types</Text>
              {[{ label: "All offer types", value: "all" }, ...GIVEAWAY_ALERT_TYPES].map((option) => (
                <Pressable key={option.value} style={styles.option} onPress={() => toggleMultiSelect(option.value, setDraftGiveawayTypes)}>
                  <Text style={styles.optionText}>{option.label}</Text>
                  {draftGiveawayTypes.includes(option.value) && <Ionicons name="checkmark-circle" size={19} color={themeColors.accentText} />}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={[styles.primaryButton, { marginTop: 12 }]} onPress={() => void saveGiveawayAlertPlatforms()}>
              <Text style={styles.primaryButtonText}>Save notification settings</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {errorMsg && (
        <Pressable style={styles.errorBanner} onPress={() => {
          const requestId = ++giveawayRequestId.current;
          setLoading(true);
          void fetchGiveaways(requestId).finally(() => {
            if (requestId === giveawayRequestId.current) setLoading(false);
          });
        }}>
          <Ionicons name="alert-circle" size={16} color={themeColors.danger} />
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
        style={isWeb ? { width: "100%", maxWidth: 1160, alignSelf: "center" } : undefined}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: isWeb ? (width >= 768 ? 28 : 16) : 15 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.categoryHeading}>
            <Text style={styles.categoryHeadingText}>{section.title}</Text>
            <Text style={styles.categoryCount}>{section.data.length}</Text>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <GamePalLoader size={108} label="Fetching free games" fullScreen={false} />
          ) : !errorMsg ? <Text style={styles.emptyText}>No giveaways match right now.</Text> : null
        }
        renderItem={({ item }) => {
          const isClaimed = claimedIds.has(item.id.toString());
          return (
            <View style={[styles.card, isWeb && width >= 768 && styles.desktopCard]}>
              <Image source={{ uri: item.thumbnail }} style={[styles.image, isWeb && width >= 768 && styles.desktopImage]} contentFit="cover" cachePolicy="memory-disk" />
                <View style={styles.cardContent}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.platform}>{item.platforms}</Text>
                
                <View style={styles.actionRow}>
                  {isClaimed ? (
                    <View style={[styles.button, styles.claimed]}>
                      <Ionicons name="checkmark-circle" size={14} color={themeColors.textSecondary} />
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
                    <Ionicons name="share-social" size={16} color={themeColors.text} />
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

const styles = createThemedStyles({
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
  modalBox: { width: "88%", maxWidth: 420, maxHeight: "88%", backgroundColor: "#1e1e1e", borderRadius: 12, padding: 10 },
  notificationTitle: { color: "#fff", fontSize: 18, fontWeight: "800", paddingHorizontal: 12, paddingTop: 10 },
  notificationSubtitle: { color: "#aaa", fontSize: 12, lineHeight: 18, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  notificationGroupTitle: { color: "#f5c518", fontSize: 12, fontWeight: "800", paddingHorizontal: 12, paddingTop: 14, paddingBottom: 4 },
  option: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#333", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  optionText: { color: "#fff", fontSize: 16 },
  primaryButton: { minHeight: 46, backgroundColor: "#f5c518", borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  primaryButtonText: { color: "#111", fontSize: 14, fontWeight: "800" },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#2a1414", marginHorizontal: 15, marginBottom: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#442020" },
  errorText: { color: "#ff8888", fontSize: 12, flex: 1 },
  emptyText: { color: "#666", textAlign: "center", marginTop: 40, fontSize: 13 },
  categoryHeading: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, marginBottom: 9, paddingHorizontal: 2 },
  categoryHeadingText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  categoryCount: { color: "#111", backgroundColor: "#f5c518", borderRadius: 10, overflow: "hidden", minWidth: 22, textAlign: "center", paddingHorizontal: 6, paddingVertical: 2, fontSize: 11, fontWeight: "800" },
  card: { flexDirection: "row", backgroundColor: "#1e1e1e", borderRadius: 12, marginBottom: 12, padding: 12, marginHorizontal: 15, borderWidth: 1, borderColor: '#2a2a2a' },
  desktopCard: { marginHorizontal: 0, padding: 16, alignItems: "center" },
  image: { width: 85, height: 85, borderRadius: 8, marginRight: 12 },
  desktopImage: { width: 190, height: 112, borderRadius: 10, marginRight: 16 },
  title: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  platform: { color: "#f5c518", fontSize: 11, marginVertical: 5 },
  cardContent: { flex: 1, minWidth: 0 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 10 },
  button: { backgroundColor: "#f5c518", paddingVertical: 8, borderRadius: 8, paddingHorizontal: 11, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  buttonText: { color: "#000", fontWeight: "bold", fontSize: 12 },
  claimed: { backgroundColor: "#333", borderWidth: 1, borderColor: '#444' },
  shareBtn: { width: 38, height: 36, paddingHorizontal: 0, backgroundColor: "#1e1e1e", borderWidth: 1, borderColor: "#444" },
});
