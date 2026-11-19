import { auth, db } from "@/lib/firebase";
import { friendshipDocumentId } from "@/lib/social";
import { createThemedStyles, themeColors, useAppTheme, useThemedAlert } from "@/lib/theme";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  loadNotificationSettings,
  LocalNotificationSettings,
  requestLocalNotificationPermission,
  saveNotificationSettings,
  showLocalNotification,
} from "@/lib/local-notifications";
import { Ionicons } from "@expo/vector-icons";
import GamingBackdrop from "@/components/GamingBackdrop";
import ProfileAvatar from "@/components/ProfileAvatar";
import { useRouter } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

type FriendEntry = { uid: string; displayName: string; username: string; avatarId?: string; avatarPreviewUrl?: string; avatarUrl?: string; status: string; requesterId: string; recipientId: string };
type SearchEntry = { uid: string; displayName: string; username: string; usernameLower: string; avatarId?: string; avatarPreviewUrl?: string; avatarUrl?: string };

export default function Friends() {
  useAppTheme();
  const showAlert = useThemedAlert();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [relationships, setRelationships] = useState<FriendEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myUsername, setMyUsername] = useState("");
  const [notificationSettings, setNotificationSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const notificationsRef = useRef(notificationSettings);

  const updateNotificationSettings = async (next: LocalNotificationSettings) => {
    notificationsRef.current = next;
    setNotificationSettings(next);
    await saveNotificationSettings(next);
  };

  const toggleFriendNotifications = async () => {
    if (notificationsRef.current.friendRequests) {
      await updateNotificationSettings({ ...notificationsRef.current, friendRequests: false });
      return;
    }
    const granted = await requestLocalNotificationPermission();
    if (!granted) {
      showAlert("Notifications are off", "Allow notifications in Android settings to receive friend request alerts.");
      return;
    }
    await updateNotificationSettings({ ...notificationsRef.current, friendRequests: true });
  };

  useEffect(() => {
    loadNotificationSettings().then((settings) => {
      notificationsRef.current = settings;
      setNotificationSettings(settings);
    });
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }

    // Older accounts may predate publicProfiles. Publish a safe searchable
    // profile for the signed-in user so other players can find them.
    void (async () => {
      try {
        const profileRef = doc(db, "users", user.uid);
        const [profileSnap, publicSnap] = await Promise.all([
          getDoc(profileRef),
          getDoc(doc(db, "publicProfiles", user.uid)),
        ]);
        const profile = profileSnap.exists() ? profileSnap.data() : {};
        const existingPublic = publicSnap.exists() ? publicSnap.data() : {};
        const username = profile.username || existingPublic.username || `player${user.uid.slice(0, 8)}`;
        const usernameLower = username.toLowerCase();
        const displayName = profile.displayName || existingPublic.displayName || user.displayName || "Gamer";
        setMyUsername(username);
        if (!publicSnap.exists() || !existingPublic.usernameLower) {
          await setDoc(doc(db, "publicProfiles", user.uid), {
            displayName,
            username,
            usernameLower,
            updatedAt: serverTimestamp(),
          });
        }
        if (profileSnap.exists() && !profile.username) {
          await setDoc(profileRef, { username, usernameLower, updatedAt: serverTimestamp() }, { merge: true });
        }
      } catch (error) {
        console.error("Could not prepare searchable profile:", error);
      }
    })();

    let firstRelationshipSnapshot = true;
    const relationshipQuery = query(collection(db, "friendships"), where("members", "array-contains", user.uid));
    const unsubscribe = onSnapshot(relationshipQuery, async (snapshot) => {
      if (firstRelationshipSnapshot) {
        firstRelationshipSnapshot = false;
      } else if (notificationsRef.current.friendRequests) {
        for (const change of snapshot.docChanges()) {
          const data = change.doc.data();
          if (change.type === "added" && data.status === "pending" && data.recipientId === user.uid) {
            const from = await getDoc(doc(db, "publicProfiles", data.requesterId));
            await showLocalNotification(
              "New friend request",
              `${from.exists() ? from.data().displayName : "A player"} sent you a friend request.`,
              { url: "/friends" },
            );
          }
        }
      }
      const items = await Promise.all(snapshot.docs.map(async (relationship) => {
        const data = relationship.data();
        const otherUid = data.members.find((member: string) => member !== user.uid);
        if (!otherUid) return null;
        const publicProfile = await getDoc(doc(db, "publicProfiles", otherUid));
        const profile = publicProfile.exists() ? publicProfile.data() : {};
        return {
          uid: otherUid,
          displayName: profile.displayName || "Gamer",
          username: profile.username || "",
          avatarId: profile.avatarId || "",
          avatarPreviewUrl: profile.avatarPreviewUrl || profile.avatarUrl || "",
          avatarUrl: profile.avatarUrl || "",
          status: data.status,
          requesterId: data.requesterId,
          recipientId: data.recipientId,
        } as FriendEntry;
      }));
      setRelationships(items.filter((item): item is FriendEntry => item !== null));
      setLoading(false);
    }, (error) => {
      console.error("Friend list listener failed:", error);
      setLoading(false);
      showAlert("Could not load friends", "Firestore denied the friend list. Publish the latest firestore.rules in Firebase Console, then reopen Friends.");
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const normalized = search.trim().replace(/^@/, "").toLowerCase();
    if (normalized.length < 2) { setResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const searchQuery = query(
          collection(db, "publicProfiles"),
          where("usernameLower", ">=", normalized),
          where("usernameLower", "<=", `${normalized}\uf8ff`),
          limit(15),
        );
        const snapshot = await getDocs(searchQuery);
        if (!cancelled) {
          setResults(snapshot.docs
            .filter((item) => item.id !== auth.currentUser?.uid)
            .map((item) => ({ uid: item.id, ...(item.data() as Omit<SearchEntry, "uid">) })));
        }
      } catch (error: any) {
        console.error("Friend search failed:", error);
        if (!cancelled) showAlert("Search unavailable", error?.code === "permission-denied"
          ? "Firebase denied public profile search. Publish the latest firestore.rules in Firebase Console."
          : "Check your connection and try searching again.");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [search]);

  const sendRequest = async (targetUid: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await setDoc(doc(db, "friendships", friendshipDocumentId(user.uid, targetUid)), {
        members: [user.uid, targetUid],
        requesterId: user.uid,
        recipientId: targetUid,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error: any) {
      console.error("Friend request failed:", error);
      showAlert("Could not send request", error?.code === "permission-denied"
        ? "Firebase denied the request. Publish the latest firestore.rules in Firebase Console."
        : "A request may already exist, or the other account has not opened Friends yet to create a searchable profile.");
    }
  };

  const acceptRequest = async (entry: FriendEntry) => {
    try {
      await updateDoc(doc(db, "friendships", friendshipDocumentId(auth.currentUser!.uid, entry.uid)), {
        status: "accepted",
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Accept request failed:", error);
      showAlert("Could not accept request", "Check that the latest Firestore rules are published.");
    }
  };

  const removeRequest = async (entry: FriendEntry) => {
    try {
      await deleteDoc(doc(db, "friendships", friendshipDocumentId(auth.currentUser!.uid, entry.uid)));
    } catch (error) {
      console.error("Remove friend request failed:", error);
      showAlert("Could not update request", "Please try again.");
    }
  };

  const goToProfile = (uid: string) => router.push({ pathname: "/friend-profile", params: { uid } });
  const me = auth.currentUser?.uid;
  const friends = relationships.filter((entry) => entry.status === "accepted");
  const incoming = relationships.filter((entry) => entry.status === "pending" && entry.recipientId === me);
  const outgoing = relationships.filter((entry) => entry.status === "pending" && entry.requesterId === me);

  const renderFriend = (entry: FriendEntry) => (
    <View key={entry.uid} style={styles.personRow}>
      <Pressable style={styles.personDetails} onPress={() => goToProfile(entry.uid)}>
        <ProfileAvatar uri={entry.avatarPreviewUrl || entry.avatarUrl} gifId={entry.avatarId} size={38} iconColor={themeColors.onAccent} backgroundColor={themeColors.accent} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.personName}>{entry.displayName}</Text>
          <Text style={styles.personUsername}>@{entry.username}</Text>
        </View>
      </Pressable>
      <Pressable style={styles.smallButton} onPress={() => goToProfile(entry.uid)}><Text style={styles.smallButtonText}>View</Text></Pressable>
    </View>
  );

  return (
    <ScrollView style={[styles.screen, Platform.OS === "web" && { width: "100%", maxWidth: 1040, alignSelf: "center" }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <GamingBackdrop />
      <View style={styles.titleRow}>
        <Text style={styles.title}>Friends</Text>
        <Pressable style={[styles.notificationButton, notificationSettings.friendRequests && styles.notificationButtonOn]} onPress={toggleFriendNotifications}>
          <Ionicons name={notificationSettings.friendRequests ? "notifications" : "notifications-outline"} size={18} color={notificationSettings.friendRequests ? themeColors.onAccent : themeColors.accentText} />
          <Text style={[styles.notificationText, notificationSettings.friendRequests && styles.notificationTextOn]}>{notificationSettings.friendRequests ? "Alerts on" : "Alerts off"}</Text>
        </Pressable>
      </View>
      <Text style={styles.subtitle}>Find players by username. Existing accounts appear after they open Friends in the updated app once. Only accepted friends can see game libraries and contact links.</Text>
      {myUsername ? <Text style={styles.myUsername}>Your username: <Text style={{ color: themeColors.text, fontWeight: "700" }}>@{myUsername}</Text></Text> : null}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={themeColors.muted} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search usernames" placeholderTextColor={themeColors.muted} autoCapitalize="none" style={styles.searchInput} />
        {searching && <ActivityIndicator color={themeColors.accentText} size="small" />}
      </View>

      {results.length > 0 && <Text style={styles.section}>PEOPLE</Text>}
      {search.trim().replace(/^@/, "").length >= 2 && !searching && results.length === 0 && (
        <Text style={styles.searchHint}>No matching players yet. Check the username, or ask them to open Friends in the updated app once.</Text>
      )}
      {results.map((person) => {
        const relationship = relationships.find((entry) => entry.uid === person.uid);
        const isIncoming = relationship?.status === "pending" && relationship.recipientId === me;
        return (
          <View key={person.uid} style={styles.personRow}>
            <View style={styles.personDetails}>
              <ProfileAvatar uri={person.avatarPreviewUrl || person.avatarUrl} gifId={person.avatarId} size={38} iconColor={themeColors.onAccent} backgroundColor={themeColors.accent} style={styles.avatar} />
              <View style={{ flex: 1 }}><Text style={styles.personName}>{person.displayName}</Text><Text style={styles.personUsername}>@{person.username}</Text></View>
            </View>
            {relationship?.status === "accepted" ? <Text style={styles.stateText}>Friends</Text>
              : relationship?.status === "pending" ? isIncoming
                ? <Pressable style={styles.smallButton} onPress={() => acceptRequest(relationship)}><Text style={styles.smallButtonText}>Accept</Text></Pressable>
                : <Text style={styles.stateText}>Requested</Text>
              : <Pressable style={styles.smallButton} onPress={() => sendRequest(person.uid)}><Text style={styles.smallButtonText}>Add</Text></Pressable>}
          </View>
        );
      })}

      {incoming.length > 0 && <Text style={styles.section}>FRIEND REQUESTS · {incoming.length}</Text>}
      {incoming.map((entry) => (
        <View key={entry.uid} style={styles.personRow}>
          <Pressable style={styles.personDetails} onPress={() => goToProfile(entry.uid)}>
            <ProfileAvatar uri={entry.avatarPreviewUrl || entry.avatarUrl} gifId={entry.avatarId} size={38} iconColor={themeColors.onAccent} backgroundColor={themeColors.accent} style={styles.avatar} />
            <View style={{ flex: 1 }}><Text style={styles.personName}>{entry.displayName}</Text><Text style={styles.personUsername}>@{entry.username}</Text></View>
          </Pressable>
          <Pressable style={styles.smallButton} onPress={() => acceptRequest(entry)}><Text style={styles.smallButtonText}>Accept</Text></Pressable>
          <Pressable style={styles.dismissButton} onPress={() => removeRequest(entry)}><Ionicons name="close" size={18} color={themeColors.muted} /></Pressable>
        </View>
      ))}

      {outgoing.length > 0 && <Text style={styles.section}>SENT REQUESTS · {outgoing.length}</Text>}
      {outgoing.map((entry) => (
        <View key={entry.uid} style={styles.personRow}>
          <Pressable style={styles.personDetails} onPress={() => goToProfile(entry.uid)}>
            <ProfileAvatar uri={entry.avatarPreviewUrl || entry.avatarUrl} gifId={entry.avatarId} size={38} iconColor={themeColors.onAccent} backgroundColor={themeColors.accent} style={styles.avatar} />
            <View style={{ flex: 1 }}><Text style={styles.personName}>{entry.displayName}</Text><Text style={styles.personUsername}>@{entry.username}</Text></View>
          </Pressable>
          <Text style={styles.stateText}>Pending</Text>
          <Pressable style={styles.dismissButton} onPress={() => removeRequest(entry)}><Ionicons name="close" size={18} color={themeColors.muted} /></Pressable>
        </View>
      ))}

      <Text style={styles.section}>YOUR FRIENDS · {friends.length}</Text>
      {loading ? <ActivityIndicator color={themeColors.accentText} style={{ marginTop: 20 }} /> : friends.length ? friends.map(renderFriend) : <Text style={styles.empty}>No friends yet. Search for a username above to add someone.</Text>}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = createThemedStyles({
  screen: { flex: 1, backgroundColor: "#121212" },
  content: { padding: 20, paddingTop: 42 },
  title: { color: "#fff", fontSize: 28, fontWeight: "800" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  notificationButton: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#262626", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  notificationButtonOn: { backgroundColor: "#f5c518" },
  notificationText: { color: "#f5c518", fontSize: 11, fontWeight: "700" },
  notificationTextOn: { color: "#111" },
  myUsername: { color: "#aaa", fontSize: 12, marginTop: -12, marginBottom: 15 },
  subtitle: { color: "#888", fontSize: 13, lineHeight: 18, marginTop: 6, marginBottom: 20 },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#1e1e1e", borderRadius: 12, paddingHorizontal: 13, height: 50, gap: 10 },
  searchInput: { flex: 1, color: "#fff", fontSize: 15 },
  searchHint: { color: "#888", fontSize: 12, lineHeight: 18, marginTop: 12, paddingHorizontal: 2 },
  section: { color: "#f5c518", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 27, marginBottom: 10 },
  personRow: { flexDirection: "row", alignItems: "center", minHeight: 66, backgroundColor: "#1b1b1b", borderRadius: 12, marginBottom: 8, paddingHorizontal: 10, paddingVertical: 7, gap: 8 },
  personDetails: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { borderRadius: 13, backgroundColor: "#f5c518", alignItems: "center", justifyContent: "center" },
  personName: { color: "#fff", fontWeight: "700", fontSize: 14 },
  personUsername: { color: "#888", fontSize: 12, marginTop: 3 },
  smallButton: { backgroundColor: "#f5c518", borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8 },
  smallButtonText: { color: "#111", fontWeight: "800", fontSize: 12 },
  stateText: { color: "#aaa", fontSize: 12, marginHorizontal: 9 },
  dismissButton: { padding: 7 },
  empty: { color: "#777", fontSize: 13, lineHeight: 19, marginTop: 4 },
});
