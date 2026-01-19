import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import {
    collection,
    onSnapshot,
    orderBy,
    query,
} from "firebase/firestore";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [claimedGames, setClaimedGames] = useState<any[]>([]);
  const [profileName, setProfileName] = useState("Player");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Profile name
    setProfileName(user.displayName || user.email || "Player");

    // 🔥 REAL-TIME LISTENER
    const ref = collection(db, "users", user.uid, "claimedGames");
    const q = query(ref, orderBy("claimedAt", "desc"));

    const unsubscribe = onSnapshot(q, (snap) => {
      const games = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setClaimedGames(games);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function handleLogout() {
    await signOut(auth);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f5c518" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* PROFILE HEADER */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profileName.charAt(0).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.profileName}>{profileName}</Text>
      </View>

      {/* CLAIMED GAMES */}
      <Text style={styles.sectionTitle}>My Claimed Games</Text>

      {claimedGames.length === 0 ? (
        <Text style={styles.empty}>No claimed games yet</Text>
      ) : (
        <FlatList
          data={claimedGames}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Image source={{ uri: item.thumbnail }} style={styles.image} />
              <View style={{ flex: 1 }}>
                <Text style={styles.gameTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.platform}>{item.platforms}</Text>
              </View>
            </View>
          )}
        />
      )}

      {/* LOGOUT */}
      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 16,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },

  profileHeader: {
    alignItems: "center",
    marginBottom: 20,
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f5c518",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },

  avatarText: {
    color: "#000",
    fontSize: 28,
    fontWeight: "bold",
  },

  profileName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },

  empty: {
    color: "#aaa",
    marginTop: 40,
    textAlign: "center",
  },

  card: {
    flexDirection: "row",
    backgroundColor: "#1e1e1e",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },

  image: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 10,
  },

  gameTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },

  platform: {
    color: "#f5c518",
    fontSize: 11,
    marginTop: 4,
  },

  logoutBtn: {
    backgroundColor: "#e74c3c",
    padding: 14,
    borderRadius: 8,
    marginTop: 10,
  },

  logoutText: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
});
