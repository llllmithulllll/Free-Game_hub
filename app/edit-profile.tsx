import { ageFromDateOfBirth, dateOfBirthFromStorage } from "@/lib/content-filter";
import GamePalLoader from "@/components/GamePalLoader";
import ProfileAvatar from "@/components/ProfileAvatar";
import { searchProfileGifs } from "@/lib/gif-avatars";
import type { ProfileGif } from "@/lib/gif-avatars";
import { createThemedStyles, themeColors, useAppTheme, useThemedAlert } from "@/lib/theme";
import Animated, { ReduceMotion, SlideInRight } from "react-native-reanimated";
import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";

export default function EditProfile() {
  const { colors } = useAppTheme();
  const showAlert = useThemedAlert();
  const router = useRouter();
  const { requireAvatar } = useLocalSearchParams<{ requireAvatar?: string }>();
  const { width } = useWindowDimensions();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [discordHandle, setDiscordHandle] = useState("");
  const [discordUserId, setDiscordUserId] = useState("");
  const [signalLink, setSignalLink] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<ProfileGif[]>([]);
  const [gifSearchCompleted, setGifSearchCompleted] = useState(false);
  const [searchingGifs, setSearchingGifs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        const [profileSnap, linksSnap, publicSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "users", user.uid, "socialLinks", "links")),
          getDoc(doc(db, "publicProfiles", user.uid)),
        ]);
        const profile = profileSnap.exists() ? profileSnap.data() : {};
        const links = linksSnap.exists() ? linksSnap.data() : {};
        const publicProfile = publicSnap.exists() ? publicSnap.data() : {};
        setDisplayName(profile.displayName || user.displayName || "");
        setUsername(profile.username || "");
        setDateOfBirth(dateOfBirthFromStorage(profile.dateOfBirth));
        setDiscordHandle(links.discordHandle || "");
        setDiscordUserId(links.discordUserId || "");
        setSignalLink(links.signalLink || "");
        setAvatarUrl(publicProfile.avatarUrl || "");
        setAvatarPreviewUrl(publicProfile.avatarPreviewUrl || publicProfile.avatarUrl || "");
        setAvatarId(publicProfile.avatarId || "");
      } catch (error) {
        console.error("Edit profile load failed:", error);
        showAlert("Error", "Could not load your profile.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const searchGifs = async () => {
    const term = gifQuery.trim();
    if (term.length < 2) return showAlert("Search for a GIF", "Enter at least two characters.");
    setSearchingGifs(true);
    setGifSearchCompleted(false);
    setGifResults([]);
    try {
      setGifResults(await searchProfileGifs(term));
      setGifSearchCompleted(true);
    } catch (error: any) {
      console.error("Profile GIF search failed:", error);
      const message = String(error?.message || "");
      showAlert("GIF search unavailable", message.includes("EXPO_PUBLIC_GIF_API_URL")
        ? "Set EXPO_PUBLIC_GIF_API_URL to your deployed free GIF Worker URL, then restart the app."
        : "Could not reach the GIF service. Check the Worker deployment and your connection, then try again.");
    } finally {
      setSearchingGifs(false);
    }
  };

  const selectGif = (gif: ProfileGif) => {
    setAvatarUrl(gif.url);
    setAvatarPreviewUrl(gif.previewUrl);
    setAvatarId(gif.id);
  };

  const save = async () => {
    const user = auth.currentUser;
    const normalizedName = displayName.trim();
    const normalizedUsername = username.trim();
    const usernameLower = normalizedUsername.toLowerCase();
    const age = ageFromDateOfBirth(dateOfBirth);
    const normalizedSignalLink = signalLink.trim();

    if (!user) return;
    if (!normalizedName) return showAlert("Name required", "Enter a display name.");
    if (!avatarId) return showAlert("Choose a profile GIF", "Select an animated GIF so friends can recognize your profile.");
    if (!/^[a-z0-9_]{3,20}$/.test(usernameLower)) {
      return showAlert("Check your username", "Use 3–20 letters, numbers, or underscores.");
    }
    if (age === null) {
      return showAlert("Check your date of birth", "Enter a real date in YYYY-MM-DD format that is not in the future.");
    }
    if (normalizedSignalLink && !/^https:\/\/signal\.me\//i.test(normalizedSignalLink)) {
      return showAlert("Check your Signal link", "Paste the unique Signal profile link from Signal’s QR Code or Link screen.");
    }
    if (discordUserId.trim() && !/^\d{17,20}$/.test(discordUserId.trim())) {
      return showAlert("Check your Discord ID", "A Discord user ID should contain 17–20 digits.");
    }

    setSaving(true);
    try {
      const preferencesSnap = age < 18
        ? await getDoc(doc(db, "users", user.uid, "preferences", "data"))
        : null;
      const existingCategories = preferencesSnap?.exists() ? preferencesSnap.data().categories || [] : [];
      await updateProfile(user, { displayName: normalizedName });
      await Promise.all([
        setDoc(doc(db, "users", user.uid), {
          displayName: normalizedName,
          username: normalizedUsername,
          usernameLower,
          dateOfBirth: Timestamp.fromDate(new Date(`${dateOfBirth}T00:00:00.000Z`)),
          updatedAt: serverTimestamp(),
        }, { merge: true }),
        setDoc(doc(db, "publicProfiles", user.uid), {
          displayName: normalizedName,
          username: normalizedUsername,
          usernameLower,
          avatarId,
          avatarProvider: "tenor",
          updatedAt: serverTimestamp(),
        }),
        setDoc(doc(db, "users", user.uid, "socialLinks", "links"), {
          discordHandle: discordHandle.trim(),
          discordUserId: discordUserId.trim(),
          signalLink: normalizedSignalLink,
          updatedAt: serverTimestamp(),
        }),
        ...(age < 18 ? [setDoc(doc(db, "users", user.uid, "preferences", "data"), {
          categories: existingCategories,
          sexualContentFilter: true,
          updatedAt: serverTimestamp(),
        }, { merge: true })] : []),
      ]);
      showAlert("Profile saved", "Your profile is updated. Contact links are shared with accepted friends only.", [
        { text: "Done", onPress: () => requireAvatar === "1" ? router.replace("/(tabs)") : router.back() },
      ]);
    } catch (error) {
      console.error("Edit profile save failed:", error);
      showAlert("Could not save", "Please check your connection and try again. If you just updated Firestore rules, make sure they have finished publishing.");
    } finally {
      setSaving(false);
    }
  };

  const age = ageFromDateOfBirth(dateOfBirth);

  if (loading) {
    return <View style={styles.loading}><GamePalLoader size={122} label="Loading profile" /></View>;
  }

  return (
    <Animated.ScrollView
      style={[styles.screen, Platform.OS === "web" && { width: "100%", maxWidth: 900, alignSelf: "center" }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      entering={SlideInRight.duration(220).reduceMotion(ReduceMotion.System)}
    >
      {requireAvatar !== "1" && <Pressable onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={themeColors.accentText} />
        <Text style={styles.backText}>Profile</Text>
      </Pressable>}
      <Text style={styles.title}>Edit profile</Text>
      <Text style={styles.subtitle}>{requireAvatar === "1" ? "Choose an animated profile GIF to finish setting up your account, then complete the rest of your profile." : "Manage the details friends can see and the ways they can reach you."}</Text>

      <Text style={styles.section}>PROFILE</Text>
      <Text style={styles.label}>Animated profile picture</Text>
      <View style={styles.avatarPreviewRow}>
        <ProfileAvatar uri={avatarPreviewUrl} gifId={avatarId} size={70} iconColor={colors.onAccent} backgroundColor={colors.accent} />
        <Text style={[styles.hint, { color: colors.textSecondary, flex: 1, marginTop: 0, marginBottom: 0 }]}>
          {avatarUrl ? "This animated GIF will appear on your profile and to other players." : "Choose an animated GIF. Your profile needs one before it can be saved."}
        </Text>
      </View>
      <View style={styles.gifSearchRow}>
        <TextInput style={[styles.input, styles.gifSearchInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]} value={gifQuery} onChangeText={setGifQuery} placeholder="Search animated GIFs" placeholderTextColor={colors.muted} returnKeyType="search" onSubmitEditing={searchGifs} />
        <Pressable style={[styles.gifSearchButton, { backgroundColor: colors.accent }]} onPress={searchGifs} disabled={searchingGifs}>
          {searchingGifs ? <ActivityIndicator color={colors.onAccent} /> : <Ionicons name="search" size={20} color={colors.onAccent} />}
        </Pressable>
      </View>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>Powered by Tenor · Safe-filtered GIF results.</Text>
      {gifSearchCompleted && gifResults.length > 0 && <Text style={[styles.gifResultsTitle, { color: colors.text }]}>Choose a GIF · {gifResults.length} results for “{gifQuery.trim()}”</Text>}
      {gifSearchCompleted && gifResults.length > 0 && <View style={styles.gifGrid}>
        {gifResults.map((gif) => {
          const selected = avatarUrl === gif.url;
          return <Pressable key={gif.id} accessibilityRole="button" accessibilityLabel={`Choose GIF: ${gif.title}`} onPress={() => selectGif(gif)} style={[styles.gifTile, { width: Math.max(70, Math.min(94, (width - 88) / 3)), borderColor: selected ? colors.accent : colors.border, borderWidth: selected ? 3 : 1 }]}>
            <Image source={{ uri: gif.previewUrl }} contentFit="cover" cachePolicy="memory" style={styles.gifImage} />
            {selected && <View style={[styles.gifSelected, { backgroundColor: colors.accent }]}><Ionicons name="checkmark" size={14} color={colors.onAccent} /></View>}
          </Pressable>;
        })}
      </View>}
      {gifSearchCompleted && gifResults.length === 0 && <Text style={[styles.gifEmpty, { color: colors.textSecondary }]}>No GIFs found for “{gifQuery.trim()}”. Try a different search.</Text>}

      <Text style={styles.label}>Display name</Text>
      <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Your name" placeholderTextColor={themeColors.muted} />
      <Text style={styles.label}>Username</Text>
      <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="3–20 letters, numbers, or _" placeholderTextColor={themeColors.muted} autoCapitalize="none" />

      <Text style={styles.section}>AGE AND CONTENT FILTER</Text>
      <Text style={styles.label}>Date of birth</Text>
      <TextInput style={styles.input} value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-MM-DD" placeholderTextColor={themeColors.muted} keyboardType="numbers-and-punctuation" maxLength={10} />
      <Text style={styles.hint}>{age === null ? "Enter your birth date to calculate your age." : `Age ${age}${age < 18 ? " · sexual-content filtering stays on" : ""}`}</Text>

      <Text style={styles.section}>CONTACT · FRIENDS ONLY</Text>
      <Text style={styles.label}>Discord username</Text>
      <TextInput style={styles.input} value={discordHandle} onChangeText={setDiscordHandle} placeholder="Your Discord username" placeholderTextColor={themeColors.muted} autoCapitalize="none" />
      <Text style={styles.label}>Discord user ID (optional)</Text>
      <TextInput style={styles.input} value={discordUserId} onChangeText={setDiscordUserId} placeholder="17–20 digit ID for a direct profile link" placeholderTextColor={themeColors.muted} keyboardType="numeric" />
      <Text style={styles.label}>Signal profile link</Text>
      <TextInput style={styles.input} value={signalLink} onChangeText={setSignalLink} placeholder="https://signal.me/…" placeholderTextColor={themeColors.muted} autoCapitalize="none" />
      <Text style={styles.hint}>In Signal, open your profile, then QR Code or Link and copy your personal link. No phone number is needed here.</Text>

      <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color={themeColors.onAccent} /> : <Text style={styles.saveText}>Save profile</Text>}
      </Pressable>
      <View style={{ height: 36 }} />
    </Animated.ScrollView>
  );
}

const styles = createThemedStyles({
  screen: { flex: 1, backgroundColor: "#121212" },
  content: { padding: 22, paddingTop: 42 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#121212" },
  back: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 24 },
  backText: { color: "#f5c518", fontSize: 15, fontWeight: "600" },
  title: { color: "#fff", fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#999", fontSize: 14, lineHeight: 20, marginTop: 7, marginBottom: 14 },
  section: { color: "#f5c518", fontSize: 12, fontWeight: "800", letterSpacing: 1, marginTop: 24, marginBottom: 12 },
  label: { color: "#ddd", fontSize: 13, fontWeight: "600", marginBottom: 7 },
  input: { backgroundColor: "#1e1e1e", color: "#fff", borderRadius: 11, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#303030" },
  hint: { color: "#888", fontSize: 12, lineHeight: 17, marginTop: -7, marginBottom: 4 },
  saveButton: { backgroundColor: "#f5c518", borderRadius: 12, minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: 26 },
  saveText: { color: "#111", fontWeight: "800", fontSize: 16 },
  avatarPreviewRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  gifSearchRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  gifSearchInput: { flex: 1, width: "auto", marginBottom: 0 },
  gifSearchButton: { width: 50, height: 48, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  gifGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 8 },
  gifResultsTitle: { fontSize: 13, fontWeight: "700", marginTop: 10 },
  gifEmpty: { fontSize: 13, lineHeight: 19, marginTop: 10, marginBottom: 8 },
  gifTile: { height: 88, borderRadius: 12, overflow: "hidden", position: "relative" },
  gifImage: { width: "100%", height: "100%" },
  gifSelected: { position: "absolute", right: 5, top: 5, width: 23, height: 23, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
