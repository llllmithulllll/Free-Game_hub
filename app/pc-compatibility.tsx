import { FpsEstimate, HardwareKind, HardwareOption, PcProfile, fetchFpsEstimate, loadPcProfile, savePcProfile, searchPcCatalog } from "@/lib/pc-performance";
import { createThemedStyles, themeColors, useAppTheme, useThemedAlert } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import GamingBackdrop from "@/components/GamingBackdrop";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

const RESOLUTIONS: PcProfile["resolution"][] = ["1080p", "1440p", "4K"];
const PRESETS: PcProfile["preset"][] = ["low", "medium", "high", "ultra"];
const FPS_THRESHOLDS = [30, 45, 60];
type CompatibleGame = { game: HardwareOption; estimate: FpsEstimate };

export default function PcCompatibility() {
  const { colors } = useAppTheme();
  const showAlert = useThemedAlert();
  const router = useRouter();
  const params = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = params.onboarding === "1";

  const [gpuQuery, setGpuQuery] = useState("");
  const [cpuQuery, setCpuQuery] = useState("");
  const [gameQuery, setGameQuery] = useState("");
  const [gpuResults, setGpuResults] = useState<HardwareOption[]>([]);
  const [cpuResults, setCpuResults] = useState<HardwareOption[]>([]);
  const [gameResults, setGameResults] = useState<HardwareOption[]>([]);
  const [gpu, setGpu] = useState<HardwareOption | null>(null);
  const [cpu, setCpu] = useState<HardwareOption | null>(null);
  const [deviceType, setDeviceType] = useState<"desktop" | "laptop">("desktop");
  const [game, setGame] = useState<HardwareOption | null>(null);
  const [ramGb, setRamGb] = useState("16");
  const [resolution, setResolution] = useState<PcProfile["resolution"]>("1080p");
  const [preset, setPreset] = useState<PcProfile["preset"]>("high");
  const [estimate, setEstimate] = useState<FpsEstimate | null>(null);
  const [compatibleGames, setCompatibleGames] = useState<CompatibleGame[]>([]);
  const [minimumFps, setMinimumFps] = useState(30);
  const [filteringGames, setFilteringGames] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pcProfileLoadError, setPcProfileLoadError] = useState<string | null>(null);
  const [searching, setSearching] = useState<HardwareKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    loadPcProfile().then((saved) => {
      if (!saved) return;
      setGpu({ type: "gpu", slug: saved.gpuSlug, name: saved.gpuName });
      setGpuQuery(saved.gpuName);
      setDeviceType(saved.deviceType || (/laptop|mobile|notebook|max[ -]?q/i.test(saved.gpuName) ? "laptop" : "desktop"));
      setCpu({ type: "cpu", slug: saved.cpuSlug, name: saved.cpuName });
      setCpuQuery(saved.cpuName);
      setRamGb(String(saved.ramGb));
      setResolution(saved.resolution);
      setPreset(saved.preset);
    }).catch((error) => {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (code.includes("permission-denied")) {
        setPcProfileLoadError("Saved PC details could not be loaded because Firestore denied access. Publish the latest firestore.rules file in the Firebase Console, then reopen this page.");
      } else {
        console.warn("Could not load PC profile:", error);
        setPcProfileLoadError("Could not load saved PC details. Check your connection and try again.");
      }
    }).finally(() => setInitialLoading(false));
  }, []);

  const finishOnboarding = () => router.replace("/(tabs)");

  const runSearch = async (kind: HardwareKind, query: string) => {
    if (query.trim().length < 2) return;
    setSearching(kind);
    try {
      const result = await searchPcCatalog(query, kind, deviceType);
      if (kind === "gpu") setGpuResults(result);
      else if (kind === "cpu") setCpuResults(result);
      else setGameResults(result);
      if (!result.length) showAlert("No matches found", "Try a shorter search or the manufacturer and model name.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      if (kind === "gpu" || kind === "cpu") {
        const name = query.trim();
        const manualOption: HardwareOption = {
          type: kind,
          slug: `manual-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120)}`,
          name,
          customOnly: true,
        };
        if (kind === "gpu") setGpuResults([manualOption]);
        else setCpuResults([manualOption]);
        showAlert("Hardware search unavailable", `${message}\n\nYou can save the name manually, but FPS forecasts require a matching FPSHQ catalog item.`);
      } else {
        showAlert("Search unavailable", message);
      }
    } finally {
      setSearching(null);
    }
  };

  const currentProfile = (): PcProfile | null => {
    const ram = Number(ramGb);
    if (!gpu || !cpu || !Number.isInteger(ram) || ram < 1 || ram > 1024) return null;
    return { deviceType, gpuSlug: gpu.slug, gpuName: gpu.name, cpuSlug: cpu.slug, cpuName: cpu.name, ramGb: ram, resolution, preset };
  };

  const save = async (continueOnboarding = false) => {
    const profile = currentProfile();
    if (!profile) {
      showAlert("Complete your PC details", "Choose a graphics card and processor, then enter a valid amount of RAM.");
      return;
    }
    setSaving(true);
    try {
      const syncedToAccount = await savePcProfile(profile);
      if (continueOnboarding) {
        if (!syncedToAccount) showAlert("Saved on this device", "Account sync is unavailable. Check your internet connection and Firestore rules to sync this profile across devices.");
        finishOnboarding();
      } else if (syncedToAccount) {
        showAlert("PC details saved", "Your hardware profile is private to your account and ready for FPS lookups.");
      } else {
        showAlert("Saved on this device", "Account sync is unavailable. Check your internet connection and Firestore rules to sync this profile across devices.");
      }
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      const message = code.includes("permission-denied")
        ? "Firestore rejected this save. Publish the latest firestore.rules file in Firebase Console, then try again."
        : error instanceof Error ? error.message : "Check your connection and Firestore rules.";
      showAlert("Could not save PC details", message);
    } finally {
      setSaving(false);
    }
  };

  const checkGame = async () => {
    const profile = currentProfile();
    if (!profile) {
      showAlert("Add your PC details first", "Choose your graphics card, processor, and RAM before checking FPS.");
      return;
    }
    if (profile.gpuSlug.startsWith("manual-") || profile.cpuSlug.startsWith("manual-")) {
      showAlert("FPS estimate unavailable", "Your hardware name was saved manually. Forecasts need an exact FPSHQ catalog match; reconnect and select the catalog result when available.");
      return;
    }
    if (!game) {
      showAlert("Choose a game", "Search the FPS catalog and select the exact game you want to check.");
      return;
    }
    setCalculating(true);
    setEstimate(null);
    try {
      setEstimate(await fetchFpsEstimate(game, profile));
    } catch (error) {
      showAlert("Could not estimate FPS", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setCalculating(false);
    }
  };

  const filterGamesByPc = async () => {
    const profile = currentProfile();
    if (!profile) {
      showAlert("Add your PC details first", "Choose a graphics card, processor, and RAM before filtering games.");
      return;
    }
    if (profile.gpuSlug.startsWith("manual-") || profile.cpuSlug.startsWith("manual-")) {
      showAlert("FPS filter unavailable", "Your hardware name was saved manually. Game forecasts need an exact FPSHQ catalog match.");
      return;
    }
    const candidates = gameResults.slice(0, 8);
    if (!candidates.length) {
      showAlert("Search for games first", "Enter a game title, then search to get a small set of matches to check.");
      return;
    }
    setFilteringGames(true);
    setCompatibleGames([]);
    try {
      const forecasts = await Promise.allSettled(candidates.map(async (candidate) => ({
        game: candidate,
        estimate: await fetchFpsEstimate(candidate, profile),
      })));
      const checked = forecasts.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      setCompatibleGames(checked.filter((item) => item.estimate.fps >= minimumFps).sort((a, b) => b.estimate.fps - a.estimate.fps));
      if (!checked.length) showAlert("No estimates available", "The FPS service did not return results for these titles. Try selecting a game directly or retry later.");
    } finally {
      setFilteringGames(false);
    }
  };

  const skip = () => {
    if (isOnboarding) finishOnboarding();
    else router.back();
  };

  const renderHardwareSearch = (kind: "gpu" | "cpu", label: string, query: string, setQuery: (value: string) => void, selected: HardwareOption | null, setSelected: (item: HardwareOption | null) => void, results: HardwareOption[], setResults: (items: HardwareOption[]) => void) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={(value) => { setQuery(value); setSelected(null); setResults([]); }}
          onSubmitEditing={() => void runSearch(kind, query)}
          placeholder={`Search ${kind === "gpu" ? "graphics card" : "processor"}`}
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          accessibilityLabel={label}
        />
        <Pressable style={styles.searchButton} onPress={() => void runSearch(kind, query)} disabled={searching === kind}>
          {searching === kind ? <ActivityIndicator color={colors.onAccent} /> : <Ionicons name="search" size={18} color={colors.onAccent} />}
        </Pressable>
      </View>
      {selected && <Text style={styles.selectedHint}>{selected.customOnly || selected.slug.startsWith("manual-") ? `Saved manually: ${selected.name} · forecasts need a catalog match` : `Selected: ${selected.name}`}</Text>}
      {results.map((item) => (
        <Pressable key={item.slug} style={styles.resultRow} onPress={() => { setSelected(item); setQuery(item.name); setResults([]); setEstimate(null); }}>
          <Text style={styles.resultText}>{item.customOnly ? `Use “${item.name}” manually · no FPS forecast` : `${item.name}${item.year ? ` (${item.year})` : ""}`}</Text>
          <Ionicons name="checkmark-circle-outline" size={19} color={colors.accentText} />
        </Pressable>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <GamingBackdrop />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          {!isOnboarding && <Pressable style={styles.backButton} onPress={skip} accessibilityLabel="Back"><Ionicons name="arrow-back" size={21} color={colors.accentText} /></Pressable>}
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{isOnboarding ? "OPTIONAL SETUP" : "YOUR PC"}</Text>
            <Text style={styles.title}>{isOnboarding ? "Can your PC run it?" : "PC compatibility"}</Text>
          </View>
          {isOnboarding && <Pressable onPress={skip} style={styles.skipButton}><Text style={styles.skipText}>Later</Text></Pressable>}
        </View>
        <Text style={styles.description}>Add your hardware to see an FPS forecast for games. You can change this anytime in Profile settings.</Text>

        {!!pcProfileLoadError && !initialLoading && <View style={[styles.permissionNotice, { backgroundColor: colors.dangerSurface, borderColor: colors.danger }]}><Ionicons name="warning-outline" size={19} color={colors.danger} /><Text style={[styles.permissionNoticeText, { color: colors.text }]}>{pcProfileLoadError}</Text></View>}

        {initialLoading ? <ActivityIndicator style={{ marginVertical: 30 }} color={colors.accentText} /> : (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>What are you using?</Text>
              <View style={styles.choices}>
                <Choice value="Desktop PC" active={deviceType === "desktop"} onPress={() => setDeviceType("desktop")} />
                <Choice value="Laptop" active={deviceType === "laptop"} onPress={() => setDeviceType("laptop")} />
              </View>
              {deviceType === "laptop" && <Text style={styles.sectionDescription}>Laptop GPU and mobile CPU variants are ranked first in hardware search.</Text>}
              {renderHardwareSearch("gpu", "Graphics card (GPU)", gpuQuery, setGpuQuery, gpu, (item) => setGpu(item), gpuResults, setGpuResults)}
              {renderHardwareSearch("cpu", "Processor (CPU)", cpuQuery, setCpuQuery, cpu, (item) => setCpu(item), cpuResults, setCpuResults)}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>System memory (RAM)</Text>
                <View style={styles.searchRow}><TextInput style={styles.input} value={ramGb} onChangeText={setRamGb} keyboardType="number-pad" placeholder="16 GB" placeholderTextColor={colors.muted} accessibilityLabel="RAM in gigabytes" /><Text style={styles.unit}>GB</Text></View>
              </View>
              <Text style={styles.label}>Resolution</Text>
              <View style={styles.choices}>{RESOLUTIONS.map((item) => <Choice key={item} value={item} active={resolution === item} onPress={() => { setResolution(item); setEstimate(null); }} />)}</View>
              <Text style={styles.label}>Graphics preset</Text>
              <View style={styles.choices}>{PRESETS.map((item) => <Choice key={item} value={item[0].toUpperCase() + item.slice(1)} active={preset === item} onPress={() => { setPreset(item); setEstimate(null); }} />)}</View>
              <Pressable style={styles.primaryButton} onPress={() => void save(isOnboarding)} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.primaryText}>{isOnboarding ? "Save & continue" : "Save my PC"}</Text>}
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Check a game</Text>
              <Text style={styles.sectionDescription}>Search for a title, then get the forecast for your selected resolution and preset.</Text>
              <View style={styles.searchRow}>
                <TextInput style={styles.input} value={gameQuery} onChangeText={(value) => { setGameQuery(value); setGame(null); setGameResults([]); setEstimate(null); }} onSubmitEditing={() => void runSearch("game", gameQuery)} placeholder="Search PC games" placeholderTextColor={colors.muted} returnKeyType="search" accessibilityLabel="Search game" />
                <Pressable style={styles.searchButton} onPress={() => void runSearch("game", gameQuery)} disabled={searching === "game"}>
                  {searching === "game" ? <ActivityIndicator color={colors.onAccent} /> : <Ionicons name="search" size={18} color={colors.onAccent} />}
                </Pressable>
              </View>
              {gameResults.map((item) => <Pressable key={item.slug} style={styles.resultRow} onPress={() => { setGame(item); setGameQuery(item.name); setGameResults([]); setEstimate(null); }}><Text style={styles.resultText}>{item.name}{item.year ? ` (${item.year})` : ""}</Text><Ionicons name="chevron-forward" size={19} color={colors.accentText} /></Pressable>)}
              {gameResults.length > 0 && <>
                <Text style={styles.label}>Show games forecasting at least</Text>
                <View style={styles.choices}>{FPS_THRESHOLDS.map((value) => <Choice key={value} value={`${value} FPS`} active={minimumFps === value} onPress={() => { setMinimumFps(value); setCompatibleGames([]); }} />)}</View>
                <Pressable style={[styles.secondaryButton, filteringGames && { opacity: 0.6 }]} onPress={() => void filterGamesByPc()} disabled={filteringGames}>
                  {filteringGames ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.secondaryText}>Filter these results for my PC ({gameResults.length})</Text>}
                </Pressable>
              </>}
              {compatibleGames.map(({ game: compatibleGame, estimate: result }) => (
                <Pressable key={compatibleGame.slug} style={styles.compatibleRow} onPress={() => { setGame(compatibleGame); setGameQuery(compatibleGame.name); setEstimate(result); }}>
                  <View style={{ flex: 1 }}><Text style={styles.resultText}>{compatibleGame.name}</Text><Text style={styles.resultMeta}>{result.source === "benchmark" ? "Measured benchmark" : "Model estimate"} · {result.verdict || "Forecast"}</Text></View>
                  <Text style={styles.compatibleFps}>{result.fps} FPS</Text>
                </Pressable>
              ))}
              {game && <Text style={styles.selectedHint}>Selected: {game.name}</Text>}
              <Pressable style={[styles.secondaryButton, (calculating || !game) && { opacity: 0.55 }]} onPress={() => void checkGame()} disabled={calculating}>
                {calculating ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.secondaryText}>Estimate FPS</Text>}
              </Pressable>
              {estimate && <View style={styles.estimateBox}>
                <Text style={styles.estimateGame}>{estimate.game?.name || game?.name}</Text>
                <Text style={styles.fpsValue}>{estimate.fps}{estimate.fps_range ? ` (${estimate.fps_range.min ?? estimate.fps_min}–${estimate.fps_range.max ?? estimate.fps_max})` : estimate.fps_min !== undefined && estimate.fps_max !== undefined && estimate.fps_min !== estimate.fps_max ? ` (${estimate.fps_min}–${estimate.fps_max})` : ""} FPS</Text>
                {typeof estimate.fps_1pct_low === "number" && <Text style={styles.resultMeta}>1% low: about {estimate.fps_1pct_low} FPS</Text>}
                <Text style={styles.resultMeta}>{resolution} · {preset} · {estimate.verdict || "Forecast"}</Text>
                <Text style={styles.resultMeta}>Source: {estimate.source === "benchmark" ? "measured benchmark" : "model estimate"} by FPSHQ</Text>
                {!!estimate.url && <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(estimate.url!)}><Text style={styles.attribution}>Data by FPSHQ · Open source</Text></Pressable>}
              </View>}
            </View>
            {isOnboarding && <Pressable onPress={skip} style={styles.laterLink}><Text style={styles.laterText}>I’ll add my PC later</Text></Pressable>}
            <Text style={styles.disclaimer}>FPS is an estimate or reported benchmark, not a guarantee. Drivers, laptop power limits, cooling, game updates, and scenes can change results. Hardware details are stored in your private account profile.</Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Choice({ value, active, onPress }: { value: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{value}</Text></Pressable>;
}

const styles = createThemedStyles({
  screen: { flex: 1, backgroundColor: "#121212" },
  content: { width: "100%", maxWidth: 820, alignSelf: "center", padding: 20, paddingBottom: 48 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#1e1e1e" },
  eyebrow: { color: "#f5c518", fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginBottom: 4 },
  title: { color: "#fff", fontSize: 25, fontWeight: "900" },
  description: { color: "#aaa", fontSize: 14, lineHeight: 21, marginBottom: 18 },
  permissionNotice: { flexDirection: "row", alignItems: "flex-start", gap: 9, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  permissionNoticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  skipButton: { backgroundColor: "#1e1e1e", borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16 },
  skipText: { color: "#ddd", fontWeight: "700" },
  card: { backgroundColor: "#181b20", borderColor: "#343b46", borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 16, gap: 12 },
  sectionTitle: { color: "#fff", fontSize: 19, fontWeight: "800" },
  sectionDescription: { color: "#aab3c0", fontSize: 13, lineHeight: 19, marginTop: -6 },
  fieldGroup: { gap: 8 },
  label: { color: "#e6eaf0", fontSize: 14, fontWeight: "700" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, minWidth: 0, height: 48, borderWidth: 1, borderColor: "#3a424f", borderRadius: 12, backgroundColor: "#101318", color: "#f5f7fa", paddingHorizontal: 13, fontSize: 14 },
  searchButton: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#f5c518", alignItems: "center", justifyContent: "center" },
  unit: { color: "#aab3c0", marginHorizontal: 4, fontWeight: "700" },
  selectedHint: { color: "#46ca90", fontSize: 12, marginTop: 4 },
  resultRow: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: "#343b46", backgroundColor: "#20252d", paddingHorizontal: 12, marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  compatibleRow: { minHeight: 54, borderRadius: 11, borderWidth: 1, borderColor: "#343b46", backgroundColor: "#20252d", paddingHorizontal: 12, paddingVertical: 8, marginTop: 7, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  compatibleFps: { color: "#f5c518", fontSize: 16, fontWeight: "900" },
  resultText: { color: "#f5f7fa", fontSize: 13, flex: 1 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: -4 },
  choice: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: "#3a424f", backgroundColor: "#20252d" },
  choiceActive: { backgroundColor: "#332c13", borderColor: "#f5c518" },
  choiceText: { color: "#cbd2dc", fontSize: 13, fontWeight: "700" },
  choiceTextActive: { color: "#f5c518" },
  primaryButton: { minHeight: 48, borderRadius: 13, backgroundColor: "#f5c518", alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryText: { color: "#111318", fontSize: 14, fontWeight: "900" },
  secondaryButton: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#f5c518", alignItems: "center", justifyContent: "center", marginTop: 8 },
  secondaryText: { color: "#f5c518", fontSize: 14, fontWeight: "800" },
  estimateBox: { marginTop: 8, backgroundColor: "#101318", borderColor: "#343b46", borderWidth: 1, borderRadius: 14, padding: 15, gap: 5 },
  estimateGame: { color: "#fff", fontSize: 16, fontWeight: "800" },
  fpsValue: { color: "#f5c518", fontSize: 24, fontWeight: "900", marginVertical: 2 },
  resultMeta: { color: "#aab3c0", fontSize: 12 },
  attribution: { color: "#8bbcff", fontSize: 11, marginTop: 4 },
  laterLink: { alignSelf: "center", padding: 12 },
  laterText: { color: "#d1d7df", fontSize: 14, fontWeight: "700" },
  disclaimer: { color: "#9099a6", fontSize: 11, lineHeight: 17, paddingHorizontal: 4, marginTop: 2 },
});

