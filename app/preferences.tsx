import { auth, db } from "@/lib/firebase";
import { createThemedStyles, themeColors, useAppTheme, useThemedAlert } from "@/lib/theme";
import { useRouter } from "expo-router";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

const CATEGORIES = ["Action", "Shooter", "MMORPG", "Racing", "Sports", "Strategy"];

export default function Preferences() {
  useAppTheme();
  const showAlert = useThemedAlert();
  const router = useRouter();
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadPrefs = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid, "preferences", "data"));
      if (snap.exists()) setSelectedCats(snap.data().categories || []);
    };
    loadPrefs();
  }, []);

  const toggleCat = (cat: string) => {
    const lower = cat.toLowerCase();
    setSelectedCats(prev => 
      prev.includes(lower) ? prev.filter(c => c !== lower) : [...prev, lower]
    );
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      setSaving(true);
      // ✅ Saves to cloud database
      await setDoc(doc(db, "users", user.uid, "preferences", "data"), {
        categories: selectedCats,
        sexualContentFilter: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      router.replace("/pc-compatibility?onboarding=1");
    } catch (e) {
      showAlert("Error", "Failed to sync preferences.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What do you like to play?</Text>
      <View style={styles.grid}>
        {CATEGORIES.map(cat => (
          <Pressable 
            key={cat} 
            style={[styles.chip, selectedCats.includes(cat.toLowerCase()) && styles.activeChip]}
            onPress={() => toggleCat(cat)}
          >
            <Text style={styles.chipText}>{cat}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.btn} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={themeColors.onAccent} /> : <Text style={styles.btnText}>Save & Sync</Text>}
      </Pressable>
    </View>
  );
}

const styles = createThemedStyles({
  container: { flex: 1, backgroundColor: "#121212", padding: 20, justifyContent: "center" },
  title: { color: "#fff", fontSize: 22, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  chip: { padding: 12, borderRadius: 20, borderWidth: 1, borderColor: "#333" },
  activeChip: { backgroundColor: "#f5c518", borderColor: "#f5c518" },
  chipText: { color: "#fff", fontWeight: "bold" },
  btn: { backgroundColor: "#f5c518", padding: 15, borderRadius: 10, marginTop: 30 },
  btnText: { textAlign: "center", fontWeight: "bold", color: "#000" }
});""
