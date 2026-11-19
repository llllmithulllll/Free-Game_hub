import { isSexualContentGame, shouldFilterSexualContent } from "@/lib/content-filter";
import GamePalLoader from "@/components/GamePalLoader";
import ProfileAvatar from "@/components/ProfileAvatar";
import { createThemedStyles, themeColors, useAppTheme } from "@/lib/theme";
import { auth, db } from "@/lib/firebase";
import { friendshipDocumentId } from "@/lib/social";
import Animated, { ReduceMotion, SlideInRight } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, collectionGroup, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Linking, Pressable, Share, Text, View } from "react-native";

export default function FriendProfile() {
  useAppTheme();
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [games, setGames] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [links, setLinks] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [loadNotice, setLoadNotice] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const load = async () => {
      const viewer = auth.currentUser;
      if (!viewer || !uid || Array.isArray(uid)) { setLoading(false); return; }
      try {
        const pairId = friendshipDocumentId(viewer.uid, uid);
        const friendshipSnap = await getDoc(doc(db, "friendships", pairId));
        if (!friendshipSnap.exists()) {
          setLoadError("No friend request exists between these accounts. Add each other from the Friends page first.");
          return;
        }
        if (friendshipSnap.data().status !== "accepted") {
          setLoadError("This friend request is still pending. The recipient must accept it on the Friends page before the profile can be viewed.");
          return;
        }
        const profileSnap = await getDoc(doc(db, "publicProfiles", uid));
        if (!profileSnap.exists()) {
          setLoadError("This account has not published a searchable profile yet. Ask them to open the Friends page in the latest app version.");
          return;
        }
        setProfile(profileSnap.data());

        const results = await Promise.allSettled([
          getDocs(collection(db, "users", uid, "gameStatus")),
          getDocs(query(collectionGroup(db, "reviews"), where("userId", "==", uid), limit(30))),
          getDoc(doc(db, "users", uid, "socialLinks", "links")),
          getDoc(doc(db, "users", viewer.uid)),
          getDoc(doc(db, "users", viewer.uid, "preferences", "data")),
        ] as const);
        const [gameResult, reviewResult, linksResult, viewerProfileResult, viewerPreferencesResult] = results;
        const denied = results.some((result) => result.status === "rejected" && (result.reason as any)?.code === "permission-denied");
        if (denied) {
          setLoadNotice("Your friend link is accepted, but Firestore blocked part of the profile. Publish the latest firestore.rules file in Firebase Console, then reopen this profile.");
        } else if (results.some((result) => result.status === "rejected")) {
          setLoadNotice("Some profile details could not load. Check your connection and reopen this profile.");
        }
        const gameSnap = gameResult.status === "fulfilled" ? gameResult.value : null;
        const reviewSnap = reviewResult.status === "fulfilled" ? reviewResult.value : null;
        const linksSnap = linksResult.status === "fulfilled" ? linksResult.value : null;
        const viewerProfileSnap = viewerProfileResult.status === "fulfilled" ? viewerProfileResult.value : null;
        const viewerPreferencesSnap = viewerPreferencesResult.status === "fulfilled" ? viewerPreferencesResult.value : null;
        const viewerProfile = viewerProfileSnap?.exists() ? viewerProfileSnap.data() : {};
        const viewerPreferences = viewerPreferencesSnap?.exists() ? viewerPreferencesSnap.data() : {};
        const hideSexual = shouldFilterSexualContent(viewerProfile.dateOfBirth, viewerPreferences.sexualContentFilter);
        const gameRows = gameSnap?.docs.map((item) => ({ id: item.id, ...item.data() })) || [];
        setGames(hideSexual ? gameRows.filter((game: any) => !isSexualContentGame(game)) : gameRows);
        const reviewGameIds = [...new Set((reviewSnap?.docs || []).map((item) => item.ref.parent.parent?.id || ""))].filter(Boolean).slice(0, 12);
        let gameTitles = new Map<string, string>();
        try {
          const gameTitleSnaps = await Promise.all(reviewGameIds.map((gameId) => getDoc(doc(db, "global_games", gameId))));
          gameTitles = new Map(gameTitleSnaps.map((item) => [item.id, item.exists() ? item.data().title : `Game #${item.id}`]));
        } catch (error) {
          console.warn("Could not load reviewed game titles:", error);
          setLoadNotice("Your friend’s profile loaded, but some review game titles could not be fetched. Reopen the profile when your connection is stable.");
        }
        const reviewRows = (reviewSnap?.docs || []).map((item) => {
          const gameId = item.ref.parent.parent?.id || "";
          return { id: item.id, gameId, gameTitle: gameTitles.get(gameId) || `Game #${gameId}`, ...item.data() };
        });
        setReviews(hideSexual ? reviewRows.filter((review: any) => !isSexualContentGame({ title: review.gameTitle })) : reviewRows);
        setLinks(linksSnap?.exists() ? linksSnap.data() : {});
      } catch (error) {
        console.error("Friend profile load failed:", error);
        const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
        setLoadError(code.includes("permission-denied")
          ? "Firestore denied access. If the request is accepted, publish the latest firestore.rules file in Firebase Console."
          : "Could not load this profile. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [uid]);

  const playing = games.filter((game) => game.status === "Playing");
  const libraryGroups = [
    { title: "Playing now", rows: playing, icon: "game-controller-outline" as const },
    { title: "Want to play", rows: games.filter((game) => game.status === "To Play"), icon: "bookmark-outline" as const },
    { title: "Completed", rows: games.filter((game) => game.status === "Completed"), icon: "trophy-outline" as const },
    { title: "Claimed", rows: games.filter((game) => game.status === "Claimed"), icon: "gift-outline" as const },
  ];

  if (loading) return <GamePalLoader size={122} label="Loading friend profile" />;
  if (!profile) return <View style={styles.loading}>
    <Pressable style={styles.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={themeColors.accentText} /><Text style={styles.backText}>Friends</Text></Pressable>
    <Text style={styles.loadError}>{loadError || "Profile unavailable."}</Text>
  </View>;

  const openDiscord = async () => {
    if (links.discordUserId) {
      await Linking.openURL(`https://discord.com/users/${links.discordUserId}`);
    } else if (links.discordHandle) {
      await Share.share({ message: `Discord username: ${links.discordHandle}` });
    }
  };

  return (
    <Animated.ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      entering={SlideInRight.duration(220).reduceMotion(ReduceMotion.System)}
    >
      <Pressable style={styles.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={themeColors.accentText} /><Text style={styles.backText}>Friends</Text></Pressable>
      <View style={styles.header}>
        <ProfileAvatar uri={profile.avatarPreviewUrl || profile.avatarUrl} gifId={profile.avatarId} size={58} iconColor={themeColors.onAccent} backgroundColor={themeColors.accent} />
        <View style={{ flex: 1 }}><Text style={styles.name}>{profile.displayName}</Text><Text style={styles.username}>@{profile.username}</Text></View>
        <View style={styles.friendBadge}><Ionicons name="people" size={14} color={themeColors.onAccent} /><Text style={styles.friendBadgeText}>Friends</Text></View>
      </View>
      {!!loadNotice && <View style={styles.loadNotice}><Ionicons name="information-circle-outline" size={19} color={themeColors.accentText} /><Text style={styles.loadNoticeText}>{loadNotice}</Text></View>}

      <Text style={styles.section}>CONTACT</Text>
      <View style={styles.contactCard}>
        {links.discordHandle || links.discordUserId ? (
          <Pressable style={styles.contactButton} onPress={openDiscord}>
            <Ionicons name="chatbubbles-outline" size={19} color={themeColors.accentText} />
            <Text style={styles.contactText}>Discord {links.discordHandle ? `· ${links.discordHandle}` : ""}</Text>
            <Ionicons name="open-outline" size={16} color={themeColors.muted} />
          </Pressable>
        ) : <Text style={styles.dim}>No Discord contact added.</Text>}
        {links.signalLink ? (
          <Pressable style={styles.contactButton} onPress={() => Linking.openURL(links.signalLink)}>
            <Ionicons name="shield-checkmark-outline" size={19} color={themeColors.accentText} />
            <Text style={styles.contactText}>Message on Signal</Text>
            <Ionicons name="open-outline" size={16} color={themeColors.muted} />
          </Pressable>
        ) : <Text style={styles.dim}>No Signal link added.</Text>}
      </View>

      <Text style={styles.section}>GAME LIBRARY · {games.length}</Text>
      {libraryGroups.map((group) => (
        <View key={group.title} style={styles.group}>
          <View style={styles.groupTitleRow}><Ionicons name={group.icon} size={17} color={themeColors.accentText} /><Text style={styles.groupTitle}>{group.title}</Text><Text style={styles.count}>{group.rows.length}</Text></View>
          {group.rows.length ? group.rows.map((game) => (
            <View key={game.id} style={styles.gameRow}>
              <View style={styles.gameIcon}><Ionicons name="game-controller-outline" size={17} color={themeColors.muted} /></View>
              <Text style={styles.gameTitle} numberOfLines={2}>{game.title}</Text>
            </View>
          )) : <Text style={styles.empty}>No games here yet.</Text>}
        </View>
      ))}

      <Text style={styles.section}>REVIEWS · {reviews.length}</Text>
      {reviews.length ? reviews.map((review) => (
        <View key={review.id} style={styles.review}>
          <Text style={styles.reviewGame}>{review.gameTitle || "Game review"}</Text>
          <Text style={styles.reviewText}>{review.text}</Text>
        </View>
      )) : <Text style={styles.empty}>No reviews shared yet.</Text>}
      <View style={{ height: 90 }} />
    </Animated.ScrollView>
  );
}

const styles = createThemedStyles({
  screen: { flex: 1, backgroundColor: "#121212" },
  content: { padding: 20, paddingTop: 40 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#121212" },
  back: { flexDirection: "row", gap: 9, alignItems: "center", marginBottom: 24 },
  backText: { color: "#f5c518", fontWeight: "700" },
  header: { flexDirection: "row", alignItems: "center", gap: 15, paddingBottom: 18, borderBottomWidth: 1, borderColor: "#292929" },
  avatar: { width: 58, height: 58, borderRadius: 18, backgroundColor: "#f5c518", justifyContent: "center", alignItems: "center" },
  name: { color: "#fff", fontSize: 23, fontWeight: "800" },
  username: { color: "#888", marginTop: 4 },
  friendBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#f5c518", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  friendBadgeText: { color: "#111", fontSize: 11, fontWeight: "800" },
  section: { color: "#f5c518", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 25, marginBottom: 10 },
  contactCard: { backgroundColor: "#1b1b1b", borderRadius: 13, paddingHorizontal: 14 },
  contactButton: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, borderBottomWidth: 1, borderBottomColor: "#292929" },
  contactText: { color: "#eee", flex: 1, fontSize: 13 },
  dim: { color: "#777", fontSize: 13, paddingVertical: 14 },
  loadError: { color: "#ddd", maxWidth: 420, textAlign: "center", fontSize: 14, lineHeight: 21, padding: 20 },
  loadNotice: { flexDirection: "row", alignItems: "flex-start", gap: 9, borderWidth: 1, borderColor: "#66531a", backgroundColor: "#282312", borderRadius: 12, padding: 12, marginTop: 14 },
  loadNoticeText: { color: "#e9dfc0", flex: 1, fontSize: 12, lineHeight: 18 },
  group: { backgroundColor: "#1b1b1b", borderRadius: 13, padding: 13, marginBottom: 9 },
  groupTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  groupTitle: { color: "#eee", flex: 1, fontWeight: "700" },
  count: { color: "#777", fontSize: 12 },
  gameRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderColor: "#292929" },
  gameIcon: { width: 31, height: 31, borderRadius: 9, backgroundColor: "#292929", justifyContent: "center", alignItems: "center" },
  gameTitle: { color: "#ccc", fontSize: 13, flex: 1 },
  empty: { color: "#777", fontSize: 13, paddingVertical: 9 },
  review: { backgroundColor: "#1b1b1b", borderRadius: 12, padding: 14, marginBottom: 8 },
  reviewGame: { color: "#f5c518", fontWeight: "700", fontSize: 12, marginBottom: 6 },
  reviewText: { color: "#ddd", fontSize: 13, lineHeight: 18 },
});
