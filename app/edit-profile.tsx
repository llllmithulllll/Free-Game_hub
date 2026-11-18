import { ageFromDateOfBirth, dateOfBirthFromStorage } from "@/lib/content-filter";
import Animated, { ReduceMotion, SlideInRight } from "react-native-reanimated";
import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function EditProfile() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [discordHandle, setDiscordHandle] = useState("");
  const [discordUserId, setDiscordUserId] = useState("");
  const [signalLink, setSignalLink] = useState("");
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
        const [profileSnap, linksSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "users", user.uid, "socialLinks", "links")),
        ]);
        const profile = profileSnap.exists() ? profileSnap.data() : {};
        const links = linksSnap.exists() ? linksSnap.data() : {};
        setDisplayName(profile.displayName || user.displayName || "");
        setUsername(profile.username || "");
        setDateOfBirth(dateOfBirthFromStorage(profile.dateOfBirth));
        setDiscordHandle(links.discordHandle || "");
        setDiscordUserId(links.discordUserId || "");
        setSignalLink(links.signalLink || "");
      } catch (error) {
        console.error("Edit profile load failed:", error);
        Alert.alert("Error", "Could not load your profile.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const save = async () => {
    const user = auth.currentUser;
    const normalizedName = displayName.trim();
    const normalizedUsername = username.trim();
    const usernameLower = normalizedUsername.toLowerCase();
    const age = ageFromDateOfBirth(dateOfBirth);
    const normalizedSignalLink = signalLink.trim();

    if (!user) return;
    if (!normalizedName) return Alert.alert("Name required", "Enter a display name.");
    if (!/^[a-z0-9_]{3,20}$/.test(usernameLower)) {
      return Alert.alert("Check your username", "Use 3–20 letters, numbers, or underscores.");
    }
    if (age === null) {
      return Alert.alert("Check your date of birth", "Enter a real date in YYYY-MM-DD format that is not in the future.");
    }
    if (normalizedSignalLink && !/^https:\/\/signal\.me\//i.test(normalizedSignalLink)) {
      return Alert.alert("Check your Signal link", "Paste the unique Signal profile link from Signal’s QR Code or Link screen.");
    }
    if (discordUserId.trim() && !/^\d{17,20}$/.test(discordUserId.trim())) {
      return Alert.alert("Check your Discord ID", "A Discord user ID should contain 17–20 digits.");
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
      Alert.alert("Profile saved", "Your profile is updated. Contact links are shared with accepted friends only.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Edit profile save failed:", error);
      Alert.alert("Could not save", "Please check your connection and try again. If you just updated Firestore rules, make sure they have finished publishing.");
    } finally {
      setSaving(false);
    }
  };

  const age = ageFromDateOfBirth(dateOfBirth);

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color="#f5c518" /></View>;
  }

  return (
    <Animated.ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      entering={SlideInRight.duration(220).reduceMotion(ReduceMotion.System)}
    >
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color="#f5c518" />
        <Text style={styles.backText}>Profile</Text>
      </Pressable>
      <Text style={styles.title}>Edit profile</Text>
      <Text style={styles.subtitle}>Manage the details friends can see and the ways they can reach you.</Text>

      <Text style={styles.section}>PROFILE</Text>
      <Text style={styles.label}>Display name</Text>
      <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Your name" placeholderTextColor="#777" />
      <Text style={styles.label}>Username</Text>
      <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="3–20 letters, numbers, or _" placeholderTextColor="#777" autoCapitalize="none" />

      <Text style={styles.section}>AGE AND CONTENT FILTER</Text>
      <Text style={styles.label}>Date of birth</Text>
      <TextInput style={styles.input} value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-MM-DD" placeholderTextColor="#777" keyboardType="numbers-and-punctuation" maxLength={10} />
      <Text style={styles.hint}>{age === null ? "Enter your birth date to calculate your age." : `Age ${age}${age < 18 ? " · sexual-content filtering stays on" : ""}`}</Text>

      <Text style={styles.section}>CONTACT · FRIENDS ONLY</Text>
      <Text style={styles.label}>Discord username</Text>
      <TextInput style={styles.input} value={discordHandle} onChangeText={setDiscordHandle} placeholder="Your Discord username" placeholderTextColor="#777" autoCapitalize="none" />
      <Text style={styles.label}>Discord user ID (optional)</Text>
      <TextInput style={styles.input} value={discordUserId} onChangeText={setDiscordUserId} placeholder="17–20 digit ID for a direct profile link" placeholderTextColor="#777" keyboardType="numeric" />
      <Text style={styles.label}>Signal profile link</Text>
      <TextInput style={styles.input} value={signalLink} onChangeText={setSignalLink} placeholder="https://signal.me/…" placeholderTextColor="#777" autoCapitalize="none" />
      <Text style={styles.hint}>In Signal, open your profile, then QR Code or Link and copy your personal link. No phone number is needed here.</Text>

      <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#111" /> : <Text style={styles.saveText}>Save profile</Text>}
      </Pressable>
      <View style={{ height: 36 }} />
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
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
});
