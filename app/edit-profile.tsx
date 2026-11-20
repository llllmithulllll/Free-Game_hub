import { ageFromDateOfBirth, dateOfBirthFromStorage } from "@/lib/content-filter";
import GamePalLoader from "@/components/GamePalLoader";
import ProfileAvatar from "@/components/ProfileAvatar";
import { deleteProfileAvatar, uploadProfileAvatar } from "@/lib/profile-avatars";
import { createThemedStyles, themeColors, useAppTheme, useThemedAlert } from "@/lib/theme";
import Animated, { ReduceMotion, SlideInRight } from "react-native-reanimated";
import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from "react-native";

export default function EditProfile() {
  const { colors } = useAppTheme();
  const showAlert = useThemedAlert();
  const router = useRouter();
  const { completeProfile } = useLocalSearchParams<{ completeProfile?: string }>();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [discordHandle, setDiscordHandle] = useState("");
  const [discordUserId, setDiscordUserId] = useState("");
  const [signalLink, setSignalLink] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarStorageKey, setAvatarStorageKey] = useState("");
  const [previousAvatarStorageKey, setPreviousAvatarStorageKey] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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
        setAvatarStorageKey(publicProfile.avatarStorageKey || "");
        setPreviousAvatarStorageKey(publicProfile.avatarStorageKey || "");
      } catch (error) {
        console.error("Edit profile load failed:", error);
        showAlert("Error", "Could not load your profile.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const chooseAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return showAlert("Photo access needed", "Allow photo library access to choose a profile picture or GIF.");
    // Expo preserves animated GIF frames on Android only with quality 1 and editing disabled.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1, selectionLimit: 1 });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingAvatar(true);
    try {
      const uploaded = await uploadProfileAvatar(result.assets[0]);
      if (avatarStorageKey && avatarStorageKey !== previousAvatarStorageKey) {
        await deleteProfileAvatar(avatarStorageKey).catch((error) => console.warn("Temporary profile picture cleanup failed:", error));
      }
      setAvatarUrl(uploaded.url);
      setAvatarStorageKey(uploaded.key);
    } catch (error: any) {
      console.error("Profile picture upload failed:", error);
      showAlert("Upload failed", error?.message || "Could not upload the selected picture. Check the Worker and R2 setup, then try again.");
    } finally {
      setUploadingAvatar(false);
    }
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
          ...(avatarUrl && avatarStorageKey ? { avatarUrl, avatarStorageKey, avatarProvider: "upload" } : {}),
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
      if (previousAvatarStorageKey && previousAvatarStorageKey !== avatarStorageKey) {
        await deleteProfileAvatar(previousAvatarStorageKey).catch((error) => console.warn("Old profile picture cleanup failed:", error));
        setPreviousAvatarStorageKey(avatarStorageKey);
      }
      showAlert(
        completeProfile === "1" ? "Profile complete" : "Profile saved",
        completeProfile === "1" ? "Your profile is ready. Next, choose the games and genres you like." : "Your profile is updated. Contact links are shared with accepted friends only.",
        [{ text: "Done", onPress: () => completeProfile === "1" ? router.replace("/preferences") : router.back() }],
      );
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
      {completeProfile !== "1" && (
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={themeColors.accentText} />
          <Text style={styles.backText}>Profile</Text>
        </Pressable>
      )}
      <Text style={styles.title}>{completeProfile === "1" ? "Complete your profile" : "Edit profile"}</Text>
      <Text style={styles.subtitle}>{completeProfile === "1" ? "Add your name, username, and date of birth to finish setting up your account." : "Manage your profile details and the contact links friends can see."}</Text>

      <Text style={styles.section}>PROFILE</Text>
      <Text style={styles.label}>Profile picture · optional</Text>
      <View style={styles.avatarPreviewRow}>
        <ProfileAvatar uri={avatarUrl} size={70} iconColor={colors.onAccent} backgroundColor={colors.accent} />
        <Text style={[styles.hint, { color: colors.textSecondary, flex: 1, marginTop: 0, marginBottom: 0 }]}>
          {avatarUrl ? "Your uploaded picture or GIF appears on your profile and to other players." : "Add a photo or GIF if you like. You can save your profile without one."}
        </Text>
      </View>
      <Pressable style={[styles.chooseAvatarButton, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={chooseAvatar} disabled={uploadingAvatar}>
        {uploadingAvatar ? <ActivityIndicator color={colors.accent} /> : <Ionicons name="image-outline" size={19} color={colors.accent} />}
        <Text style={[styles.chooseAvatarText, { color: colors.text }]}>{uploadingAvatar ? "Uploading…" : avatarUrl ? "Change picture or GIF" : "Choose picture or GIF"}</Text>
      </Pressable>
      {avatarUrl && !uploadingAvatar && <Pressable style={styles.removeAvatarButton} onPress={() => {
        if (avatarStorageKey && avatarStorageKey !== previousAvatarStorageKey) {
          void deleteProfileAvatar(avatarStorageKey).catch((error) => console.warn("Temporary profile picture cleanup failed:", error));
        }
        setAvatarUrl("");
        setAvatarStorageKey("");
      }}>
        <Text style={[styles.removeAvatarText, { color: colors.textSecondary }]}>Remove profile picture</Text>
      </Pressable>}
      <Text style={[styles.hint, { color: colors.textSecondary }]}>JPEG, PNG, WebP, and animated GIF · up to 5 MB. Uploaded pictures are visible on your public profile.</Text>

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
  chooseAvatarButton: { minHeight: 48, borderRadius: 11, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginBottom: 12 },
  chooseAvatarText: { fontSize: 14, fontWeight: "700" },
  removeAvatarButton: { alignSelf: "flex-start", paddingVertical: 7, paddingHorizontal: 2, marginBottom: 7 },
  removeAvatarText: { fontSize: 13, fontWeight: "600" },
});
