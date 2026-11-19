import GamingBackdrop from "@/components/GamingBackdrop";
import { ACCENT_THEMES, AccentTheme, ThemeMode, createThemedStyles, themeColors, useAppTheme } from "@/lib/theme";
import { Fontisto, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

const MODES: { id: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "system", label: "Auto", icon: "phone-portrait-outline" },
  { id: "dark", label: "Dark", icon: "moon-outline" },
  { id: "light", label: "Light", icon: "sunny-outline" },
];

export default function Appearance() {
  const router = useRouter();
  const { mode, accentTheme, colors, setMode, setAccentTheme } = useAppTheme();
  return (
    <View style={styles.screen}>
      <GamingBackdrop />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Back to settings"><Ionicons name="arrow-back" size={21} color={colors.accentText} /></Pressable>
          <View style={{ flex: 1 }}><Text style={styles.eyebrow}>SETTINGS</Text><Text style={styles.title}>Appearance</Text></View>
          <PlatformMark theme={accentTheme} color={colors.accentText} />
        </View>
        <Text style={styles.description}>Choose how GameHub looks. Your accent colors and display mode are saved on this device.</Text>

        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Display mode</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>Auto follows your device’s appearance setting.</Text>
          <View style={styles.modeOptions}>
            {MODES.map((item) => (
              <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: mode === item.id }} onPress={() => void setMode(item.id)} style={[styles.modeOption, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }, mode === item.id && { backgroundColor: colors.accentSurface, borderColor: colors.accentBorder }]}>
                <Ionicons name={item.icon} size={19} color={mode === item.id ? colors.accentText : colors.muted} />
                <Text style={[styles.modeText, { color: mode === item.id ? colors.accentText : colors.textSecondary }]}>{item.label}</Text>
                {mode === item.id && <Ionicons name="checkmark-circle" size={16} color={colors.accentText} />}
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Accent colors</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>Changes highlights, controls, and the matching background marks.</Text>
          <View style={styles.paletteGrid}>
            {ACCENT_THEMES.map((item) => (
              <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: accentTheme === item.id }} onPress={() => void setAccentTheme(item.id)} style={[styles.paletteOption, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }, accentTheme === item.id && { backgroundColor: colors.accentSurface, borderColor: colors.accentBorder }]}>
                <View style={[styles.swatch, { backgroundColor: item.color }, item.id === "rgb" && styles.rgbSwatch]} />
                <Text style={[styles.paletteLabel, { color: accentTheme === item.id ? colors.accentText : colors.textSecondary }]}>{item.label}</Text>
                {accentTheme === item.id && <Ionicons name="checkmark" size={16} color={colors.accentText} />}
              </Pressable>
            ))}
          </View>
          {accentTheme === "rgb" && <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>RGB gently cycles neon accent colors across the interface.</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

function PlatformMark({ theme, color }: { theme: AccentTheme; color: string }) {
  if (theme === "xbox" || theme === "rgb") return <Fontisto name="xbox" size={25} color={color} />;
  if (theme === "playstation") return <Fontisto name="playstation" size={27} color={color} />;
  if (theme === "nintendo") return <MaterialCommunityIcons name="nintendo-switch" size={29} color={color} />;
  if (theme === "neon") return <Ionicons name="game-controller" size={27} color={color} />;
  return <Ionicons name="game-controller-outline" size={27} color={color} />;
}

const styles = createThemedStyles({
  screen: { flex: 1, backgroundColor: "#121212" },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 20, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#1e1e1e" },
  eyebrow: { color: "#f5c518", fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginBottom: 4 },
  title: { color: "#fff", fontSize: 25, fontWeight: "900" },
  description: { color: "#aaa", fontSize: 14, lineHeight: 21, marginBottom: 18 },
  sectionCard: { backgroundColor: "#181b20", borderColor: "#343b46", borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 16 },
  sectionTitle: { color: "#f5f7fa", fontSize: 17, fontWeight: "800" },
  sectionHint: { color: "#aab3c0", fontSize: 12, lineHeight: 18, marginTop: 5 },
  modeOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 15 },
  modeOption: { minHeight: 44, minWidth: 112, flexGrow: 1, borderRadius: 12, borderWidth: 1, borderColor: "#343b46", backgroundColor: "#20252d", paddingHorizontal: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  modeOptionSelected: { borderColor: "#f5c518", backgroundColor: "#2c2816" },
  modeText: { color: "#d0d6df", fontSize: 13, fontWeight: "700" },
  modeTextSelected: { color: "#f5c518" },
  paletteGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  paletteOption: { width: "31%", minHeight: 72, borderRadius: 13, borderWidth: 1, borderColor: "#343b46", backgroundColor: "#20252d", padding: 10, gap: 7 },
  paletteOptionSelected: { borderColor: "#f5c518", backgroundColor: "#2c2816" },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  rgbSwatch: { borderColor: "#f5f7fa", borderWidth: 2 },
  paletteLabel: { color: "#d0d6df", fontSize: 12, fontWeight: "700" },
});

