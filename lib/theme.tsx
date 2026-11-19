import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Modal, Platform, Pressable, Text, View, useColorScheme } from "react-native";

export type ThemeMode = "light" | "dark" | "system";
export type AccentTheme = "classic" | "xbox" | "playstation" | "nintendo" | "neon" | "rgb";

export const ACCENT_THEMES: { id: AccentTheme; label: string; color: string }[] = [
  { id: "classic", label: "Classic", color: "#F5C518" },
  { id: "xbox", label: "Xbox", color: "#2EBD59" },
  { id: "playstation", label: "PlayStation", color: "#1687F8" },
  { id: "nintendo", label: "Nintendo", color: "#E60012" },
  { id: "neon", label: "Neon", color: "#B45CFF" },
  { id: "rgb", label: "RGB", color: "#F0448C" },
];

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textSecondary: string;
  muted: string;
  accent: string;
  accentSurface: string;
  accentBorder: string;
  accentText: string;
  onAccent: string;
  success: string;
  danger: string;
  dangerSurface: string;
  overlay: string;
  shadow: string;
  statusBar: "light" | "dark";
};

const PALETTES: Record<"light" | "dark", ThemeColors> = {
  dark: {
    background: "#101318",
    surface: "#1A1F27",
    surfaceRaised: "#252C36",
    border: "#38414E",
    text: "#F5F7FA",
    textSecondary: "#D0D6DF",
    muted: "#A5AFBD",
    accent: "#F5C518",
    accentSurface: "#332C13",
    accentBorder: "#6E5B1C",
    accentText: "#F5C518",
    onAccent: "#111318",
    success: "#42C58A",
    danger: "#FF7777",
    dangerSurface: "#3A2025",
    overlay: "rgba(0,0,0,0.78)",
    shadow: "#000000",
    statusBar: "light",
  },
  light: {
    background: "#F3F6FA",
    surface: "#FFFFFF",
    surfaceRaised: "#E9EEF5",
    border: "#D3DBE6",
    text: "#172230",
    textSecondary: "#344457",
    muted: "#586779",
    accent: "#E9B600",
    accentSurface: "#FFF3C4",
    accentBorder: "#DDBA47",
    accentText: "#705000",
    onAccent: "#171B22",
    success: "#16764E",
    danger: "#B3261E",
    dangerSurface: "#FCE8E6",
    overlay: "rgba(20,28,39,0.48)",
    shadow: "#687589",
    statusBar: "dark",
  },
};

const STORAGE_KEY = "@gamehub_appearance_mode_v1";
const ACCENT_STORAGE_KEY = "@gamehub_accent_theme_v1";
const RGB_COLORS = ["#F0448C", "#8B5CF6", "#3182F6", "#19B7AE", "#51C943", "#F5C518"];
let activeColors: ThemeColors = PALETTES.dark;

function withAccent(base: ThemeColors, theme: AccentTheme, rgbColor: string): ThemeColors {
  if (theme === "classic") return base;
  const choice = theme === "rgb" ? rgbColor : ACCENT_THEMES.find((item) => item.id === theme)?.color ?? "#F5C518";
  const values: Record<Exclude<AccentTheme, "classic" | "rgb"> | "rgb", { darkText: string; lightText: string }> = {
    xbox: { darkText: "#54D878", lightText: "#146C2E" },
    playstation: { darkText: "#61AFFF", lightText: "#0756A5" },
    nintendo: { darkText: "#FF626D", lightText: "#B0000E" },
    neon: { darkText: "#D39CFF", lightText: "#7021B5" },
    rgb: { darkText: choice, lightText: choice },
  };
  const selected = values[theme as keyof typeof values];
  const textAccent = base.statusBar === "light" ? selected.darkText : selected.lightText;
  const rgb = /^#[\da-f]{6}$/i.test(choice) ? choice : "#F0448C";
  const rgbLightText: Record<string, string> = {
    "#F0448C": "#A01850",
    "#8B5CF6": "#5424A0",
    "#3182F6": "#124F9A",
    "#19B7AE": "#08716A",
    "#51C943": "#26751E",
    "#F5C518": "#705000",
  };
  return {
    ...base,
    accent: rgb,
    accentSurface: `${rgb}24`,
    accentBorder: `${rgb}88`,
    accentText: theme === "rgb" && base.statusBar === "dark" ? (rgbLightText[rgb] ?? textAccent) : textAccent,
    onAccent: theme === "nintendo" ? "#FFFFFF" : base.onAccent,
  };
}

type ThemeValue = {
  mode: ThemeMode;
  resolvedMode: "light" | "dark";
  accentTheme: AccentTheme;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => Promise<void>;
  setAccentTheme: (theme: AccentTheme) => Promise<void>;
};

export type ThemedAlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive" | "plain";
  onPress?: () => void;
};

type ThemedAlert = { title: string; message?: string; buttons: ThemedAlertButton[] };
type ThemedAlertValue = (title: string, message?: string, buttons?: ThemedAlertButton[]) => void;
const ThemedAlertContext = createContext<ThemedAlertValue>(() => undefined);

const ThemeContext = createContext<ThemeValue>({
  mode: "system",
  resolvedMode: "dark",
  accentTheme: "classic",
  colors: PALETTES.dark,
  setMode: async () => undefined,
  setAccentTheme: async () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme() ?? "dark";
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [accentTheme, setAccentThemeState] = useState<AccentTheme>("classic");
  const [rgbIndex, setRgbIndex] = useState(0);
  const [alert, setAlert] = useState<ThemedAlert | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") setModeState(saved);
    }).catch((error) => console.warn("Could not load appearance setting:", error));
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(ACCENT_STORAGE_KEY).then((saved) => {
      if (saved && ACCENT_THEMES.some((item) => item.id === saved)) setAccentThemeState(saved as AccentTheme);
    }).catch((error) => console.warn("Could not load accent theme:", error));
  }, []);

  useEffect(() => {
    if (accentTheme !== "rgb") return;
    const timer = setInterval(() => setRgbIndex((current) => (current + 1) % RGB_COLORS.length), 1100);
    return () => clearInterval(timer);
  }, [accentTheme]);

  const resolvedMode = mode === "system" ? systemScheme : mode;
  const colors = withAccent(PALETTES[resolvedMode], accentTheme, RGB_COLORS[rgbIndex]);
  activeColors = colors;

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const root = document.documentElement;
    const cssVariables: Record<string, string> = {
      "--gh-background": colors.background,
      "--gh-surface": colors.surface,
      "--gh-surface-raised": colors.surfaceRaised,
      "--gh-border": colors.border,
      "--gh-text": colors.text,
      "--gh-text-secondary": colors.textSecondary,
      "--gh-muted": colors.muted,
      "--gh-accent": colors.accent,
      "--gh-accent-text": colors.accentText,
      "--gh-accent-border": colors.accentBorder,
      "--gh-shadow": colors.shadow,
    };
    for (const [name, value] of Object.entries(cssVariables)) root.style.setProperty(name, value);
    root.dataset.theme = resolvedMode;
    root.style.colorScheme = resolvedMode;
    document.body.style.backgroundColor = colors.background;
    document.body.style.color = colors.text;

    let themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement("meta");
      themeColorMeta.name = "theme-color";
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.content = colors.background;
  }, [colors, resolvedMode]);

  const setMode = useCallback(async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, nextMode);
    } catch (error) {
      console.warn("Could not save appearance setting:", error);
    }
  }, []);

  const setAccentTheme = useCallback(async (nextTheme: AccentTheme) => {
    setAccentThemeState(nextTheme);
    try {
      await AsyncStorage.setItem(ACCENT_STORAGE_KEY, nextTheme);
    } catch (error) {
      console.warn("Could not save accent theme:", error);
    }
  }, []);

  const value = useMemo(() => ({ mode, resolvedMode, accentTheme, colors, setMode, setAccentTheme }), [mode, resolvedMode, accentTheme, colors, setMode, setAccentTheme]);
  const showAlert = useCallback<ThemedAlertValue>((title, message, buttons) => {
    setAlert({ title, message, buttons: buttons?.length ? buttons : [{ text: "OK" }] });
  }, []);
  const dismissAlert = useCallback(() => setAlert(null), []);

  return (
    <ThemeContext.Provider value={value}>
      <ThemedAlertContext.Provider value={showAlert}>
        {children}
        <Modal visible={!!alert} transparent animationType="fade" onRequestClose={dismissAlert} statusBarTranslucent>
          <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: 24 }}>
            <View style={{ width: "100%", maxWidth: 420, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 22, shadowColor: colors.shadow, shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
              <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 19, fontWeight: "800" }}>{alert?.title}</Text>
              {!!alert?.message && <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 10 }}>{alert.message}</Text>}
              <View style={{ marginTop: 20 }}>
                {alert?.buttons.map((button, index) => {
                  const destructive = button.style === "destructive";
                  const cancel = button.style === "cancel";
                  return (
                    <Pressable
                      key={`${button.text}-${index}`}
                      accessibilityRole="button"
                      onPress={() => {
                        dismissAlert();
                        button.onPress?.();
                      }}
                      style={({ pressed }) => ({ minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: index ? 8 : 0, paddingHorizontal: 14, borderRadius: 12, backgroundColor: cancel ? colors.surfaceRaised : destructive ? colors.dangerSurface : colors.accent, borderWidth: 1, borderColor: cancel ? colors.border : destructive ? colors.danger : colors.accent, opacity: pressed ? 0.78 : 1 })}
                    >
                      <Text style={{ color: cancel ? colors.textSecondary : destructive ? colors.danger : colors.onAccent, fontSize: 14, fontWeight: "700" }}>{button.text}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>
      </ThemedAlertContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

export function useThemedAlert() {
  return useContext(ThemedAlertContext);
}

// Used by old screen style objects and inline icon/text props. The context
// hook makes each screen rerender when the active palette changes.
export const themeColors = new Proxy({} as ThemeColors, {
  get: (_target, key) => typeof key === "string" && key in activeColors
    ? activeColors[key as keyof ThemeColors]
    : undefined,
});

function themedColor(value: string, property: string, colors: ThemeColors): string {
  const normalized = value.toLowerCase();
  const isBackground = property === "backgroundColor";
  const isBorder = property.toLowerCase().includes("border");
  const isTextColor = property === "color" || property === "tintColor";

  const backgroundTokens = ["#121212", "#111", "#111111", "#000", "#000000", "#101318"];
  const surfaceTokens = ["#1e1e1e", "#1b1b1b", "#181818", "#1a1a1a", "#181b20"];
  const raisedSurfaceTokens = ["#252525", "#202020", "#20252d", "#262626", "#282828", "#292929", "#2a2a2a", "#2b2b2b", "#2c2c2c", "#303030"];
  if (backgroundTokens.includes(normalized)) return isBackground ? colors.background : isTextColor ? colors.onAccent : isBorder ? colors.border : value;
  if (surfaceTokens.includes(normalized)) return isBackground ? colors.surface : isTextColor ? colors.text : isBorder ? colors.border : value;
  if (raisedSurfaceTokens.includes(normalized)) return isBackground ? colors.surfaceRaised : isTextColor ? colors.text : isBorder ? colors.border : value;

  if (normalized === "#f5c518" || normalized === "#ffc107") return isBackground ? colors.accent : colors.accentText;
  if (["#f5f7fa", "#f5f5f5", "#f6f6f6", "#e6eaf0"].includes(normalized)) return isTextColor ? colors.text : isBackground ? colors.surfaceRaised : value;
  if (["#d0d6df", "#cbd2dc", "#d1d7df", "#aab3c0"].includes(normalized)) return isTextColor ? colors.textSecondary : isBackground ? colors.surfaceRaised : value;
  if (["#fff", "#ffffff", "white"].includes(normalized)) return isBackground ? colors.surface : colors.text;
  if (["#eee", "#eeeeee", "#ddd", "#dddddd", "#ccc", "#cccccc"].includes(normalized)) return isTextColor ? colors.textSecondary : colors.surfaceRaised;
  if (normalized === "#bbb" || normalized === "#bbbbbb") return isTextColor ? colors.textSecondary : colors.surfaceRaised;
  if (["#2c2816", "#332c13"].includes(normalized)) return colors.accentSurface;
  if (["#6e5b1c"].includes(normalized)) return colors.accentBorder;
  if (["#2a1414"].includes(normalized)) return colors.dangerSurface;
  if (["#442020"].includes(normalized)) return colors.danger;
  if (["#a98712"].includes(normalized)) return colors.accentText;
  if (["#333", "#333333", "#343b46", "#383838", "#38414e", "#3a3a3a", "#3a424f", "#444", "#444444"].includes(normalized)) {
    return isBorder ? colors.border : isBackground ? colors.surfaceRaised : colors.muted;
  }
  if (["#aaa", "#aaaaaa", "#999", "#999999", "#888", "#888888", "#777", "#777777", "#666", "#666666", "#555", "#555555"].includes(normalized)) {
    return isTextColor || isBorder ? colors.muted : colors.surfaceRaised;
  }
  if (["#ff4444", "#ff6666", "#ff7777", "#ff8888"].includes(normalized)) return colors.danger;
  if (normalized === "#46ca90") return colors.success;
  if (normalized === "#8bbcff") return colors.accentText;
  if (["#2ecc71", "#4caf50"].includes(normalized)) return isBackground ? value : colors.success;
  if (normalized.startsWith("rgba(0,0,0")) return colors.overlay;
  if (normalized.startsWith("rgba(245,197,24")) return colors.accentSurface;
  if (isBorder && !isTextColor) return colors.border;
  return value;
}

function mapStyle(value: unknown, colors: ThemeColors): unknown {
  if (Array.isArray(value)) return value.map((item) => mapStyle(item, colors));
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [property, item] of Object.entries(value)) {
    result[property] = typeof item === "string" && /^(#|rgba?\()/i.test(item)
      ? themedColor(item, property, colors)
      : mapStyle(item, colors);
  }
  return result;
}

export function createThemedStyles<const T extends Record<string, unknown>>(definitions: T): T {
  const cache = new Map<string, { colors: ThemeColors; value: unknown }>();
  return new Proxy({} as T, {
    get: (_target, key: string | symbol) => {
      if (typeof key !== "string" || !(key in definitions)) return undefined;
      const cached = cache.get(key);
      if (cached?.colors === activeColors) return cached.value;
      const mapped = mapStyle(definitions[key as keyof T], activeColors) as Record<string, unknown> | undefined;
      const needsDepth = /card|modal|menu|box|dropdown|personRow|searchBox|gameCard|contactCard|group|review|emptyState/i.test(key);
      const value = mapped?.backgroundColor && needsDepth
        ? {
            ...mapped,
            elevation: Math.max(typeof mapped.elevation === "number" ? mapped.elevation : 0, 2),
            shadowColor: activeColors.shadow,
            shadowOpacity: activeColors.statusBar === "dark" ? 0.12 : 0.22,
            shadowRadius: 7,
            shadowOffset: { width: 0, height: 3 },
          }
        : mapped;
      cache.set(key, { colors: activeColors, value });
      return value;
    },
  });
}
