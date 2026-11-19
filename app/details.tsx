import { auth, db } from "@/lib/firebase";
import { createThemedStyles, themeColors, useAppTheme } from "@/lib/theme";
import { isSexualContentGame, shouldFilterSexualContent } from "@/lib/content-filter";
import GamePalLoader from "@/components/GamePalLoader";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

export default function Details() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams();
  const [game, setGame] = useState<any>(null);
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [userReview, setUserReview] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [contentBlocked, setContentBlocked] = useState(false);

  const cleanHtml = (text: string) => {
    if (!text) return "";
    return text
      .replace(/Minimum:|Recommended:/gi, (match) => `\n${match}\n`)
      .replace(/<br\s*\/?>/gi, '\n') 
      .replace(/<[^>]*>?/gm, '')    
      .replace(/&nbsp;/g, ' ')
      .trim();
  };

  useEffect(() => {
    if (id) {
      setGame(null);
      setStatus(null);
      fetchDetails();
      const q = query(collection(db, "games", id as string, "reviews"));
      const unsub = onSnapshot(q, (snap) => setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      return () => unsub();
    }
  }, [id]);

  async function fetchDetails() {
    try {
      setLoading(true);
      setContentBlocked(false);
      const apiKey = process.env.EXPO_PUBLIC_RAWG_API_KEY;
      
      const res = await fetch(`https://api.rawg.io/api/games/${id}?key=${apiKey}`);
      const data = await res.json();

      let hideSexualContent = true;
      if (auth.currentUser) {
        const [profileSnap, preferencesSnap] = await Promise.all([
          getDoc(doc(db, "users", auth.currentUser.uid)),
          getDoc(doc(db, "users", auth.currentUser.uid, "preferences", "data")),
        ]);
        hideSexualContent = shouldFilterSexualContent(
          profileSnap.exists() ? profileSnap.data().dateOfBirth : null,
          preferencesSnap.exists() ? preferencesSnap.data().sexualContentFilter : undefined,
        );
      }
      if (hideSexualContent && isSexualContentGame({
        name: data.name,
        description_raw: data.description_raw,
        genres: data.genres,
        tags: data.tags,
        esrb_rating: data.esrb_rating,
      })) {
        setContentBlocked(true);
        return;
      }
      
      const screenRes = await fetch(`https://api.rawg.io/api/games/${id}/screenshots?key=${apiKey}`);
      const screenData = await screenRes.json();
      setScreenshots(screenData.results || []);

      const redditRes = await fetch(`https://api.rawg.io/api/games/${id}/reddit?key=${apiKey}`);
      const redditData = await redditRes.json();

      const pcPlatforms = data.platforms?.filter((p: any) => 
        ["pc", "steam", "epic-games", "gog"].includes(p.platform.slug) ||
        p.platform.name.toLowerCase().includes("pc")
      );

      const platformWithReqs = pcPlatforms?.find((p: any) => 
        p.requirements?.minimum || p.requirements?.recommended
      );

      const rawReqs = platformWithReqs?.requirements?.minimum || platformWithReqs?.requirements?.recommended;

      const gameObj = {
        id: id as string,
        title: data.name,
        thumbnail: data.background_image,
        description: data.description_raw || "No description available.",
        genre: data.genres?.map((g: any) => g.name).join(", "),
        firstGenre: data.genres?.[0]?.name || "Game",
        requirements: rawReqs ? cleanHtml(rawReqs) : "No specific PC requirements listed for this title.",
        website: data.website,
        ratingsDistribution: data.ratings || [],
        redditReviews: redditData.results || []
      };

      setGame(gameObj);

      if (auth.currentUser) {
        const snap = await getDoc(doc(db, "users", auth.currentUser.uid, "gameStatus", id as string));
        if (snap.exists()) setStatus(snap.data().status);
      }
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  }

  const submitReview = async () => {
    if (!userReview.trim() || !auth.currentUser) return;
    await addDoc(collection(db, "games", id as string, "reviews"), {
      text: userReview,
      userName: auth.currentUser.displayName || "Gamer",
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });
    setUserReview("");
  };

  const handleShare = async () => {
    await Share.share({ message: `Check out ${game.title}!\n${game.website || 'https://rawg.io'}` });
  };

  const updateStatus = async (newStatus: string) => {
    if (!auth.currentUser) return;
    await setDoc(doc(db, "users", auth.currentUser.uid, "gameStatus", id as string), {
      status: newStatus,
      title: game.title,
      thumbnail: game.thumbnail,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    setStatus(newStatus);
  };

  if (loading) return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
        <Ionicons name="arrow-back" size={20} color={colors.accentText} />
        <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
      </Pressable>
      <GamePalLoader size={130} label="Loading game details" />
    </View>
  );
  if (contentBlocked) {
    return (
      <View style={[styles.page, { backgroundColor: colors.background, flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backButton, styles.blockedBackButton]} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={20} color={colors.accentText} />
          <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
        </Pressable>
        <Ionicons name="eye-off-outline" size={42} color={themeColors.accentText} />
        <Text style={[styles.sectionTitle, { textAlign: "center", marginTop: 16 }]}>This game is hidden by your content filter</Text>
        <Text style={[styles.meta, { textAlign: "center", marginTop: 8 }]}>You can manage the sexual-content filter in Profile settings.</Text>
      </View>
    );
  }
  if (!game) return <View style={[styles.page, { backgroundColor: colors.background }]}><GamePalLoader size={130} label="Loading game details" /></View>;

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <Image source={{ uri: game.thumbnail }} style={StyleSheet.absoluteFillObject} contentFit="cover" blurRadius={42} cachePolicy="memory-disk" />
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.overlay }]} />
      <View style={styles.topBar}>
        <View style={[styles.topBarInner, Platform.OS === "web" && { maxWidth: 1160, width: "100%" }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={20} color={colors.accentText} />
            <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent}>
      <View style={[styles.content, Platform.OS === "web" && { width: "100%", maxWidth: 1160, alignSelf: "center" }]}>
        <View style={[styles.hero, { height: Platform.OS === "web" ? Math.min(420, Math.max(260, width * 0.26)) : 250 }]}>
          <Image source={{ uri: game.thumbnail }} style={styles.heroBlur} contentFit="cover" blurRadius={28} cachePolicy="memory-disk" />
          <View style={[styles.heroShade, { backgroundColor: colors.overlay }]} />
          <Image source={{ uri: game.thumbnail }} style={styles.banner} contentFit="contain" cachePolicy="memory-disk" />
        </View>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{game.title}</Text>
            <Text style={styles.meta}>{game.genre}</Text>
          </View>
          <Pressable style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share-social" size={20} color={themeColors.accentText} />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Library Status</Text>
        <View style={styles.statusRow}>
          {["To Play", "Playing", "Completed"].map((s) => (
            <Pressable key={s} onPress={() => updateStatus(s)} style={[styles.statusTab, status === s && styles.statusTabActive]}>
              <Text style={[styles.statusTabText, status === s && styles.statusTabTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Screenshots</Text>
        <FlatList 
          horizontal 
          data={screenshots} 
          keyExtractor={(item, index) => index.toString()}
          showsHorizontalScrollIndicator={false} 
          renderItem={({ item }) => <Image source={{ uri: item.image }} style={styles.screenshot} />} 
        />

        <Text style={styles.sectionTitle}>Player Sentiment</Text>
        <View style={styles.ratingBox}>
          {game.ratingsDistribution.map((r: any) => (
            <View key={r.title} style={styles.ratingBarRow}>
              <Text style={styles.ratingLabel}>{r.title.toUpperCase()}</Text>
              <View style={styles.barBackground}>
                <View style={[styles.barFill, { width: `${r.percent}%` }]} />
              </View>
              <Text style={styles.ratingPercent}>{Math.round(r.percent)}%</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.desc}>{game.description}</Text>

        <Text style={styles.sectionTitle}>PC Requirements</Text>
        <View style={styles.reqBox}>
          <Text style={styles.reqText}>{game.requirements}</Text>
        </View>

        <Text style={styles.sectionTitle}>App Reviews</Text>
        <View style={styles.reviewInputContainer}>
          <TextInput 
            style={styles.reviewInput} 
            placeholder="Write a review..." 
            placeholderTextColor={themeColors.muted}
            value={userReview} 
            onChangeText={setUserReview} 
            multiline 
          />
          <Pressable style={styles.sendBtn} onPress={submitReview}>
            <Ionicons name="send" size={18} color={themeColors.onAccent} />
          </Pressable>
        </View>

        {reviews.map((rev) => (
          <View key={rev.id} style={styles.reviewCard}>
            <Text style={styles.reviewUser}>{rev.userName}</Text>
            <Text style={styles.reviewText}>{rev.text}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Reddit Community</Text>
        {game.redditReviews.slice(0, 3).map((post: any) => (
          <Pressable key={post.id} style={styles.redditCard} onPress={() => Linking.openURL(post.url)}>
            <Text style={styles.redditTitle}>{post.name}</Text>
            <Text style={styles.redditMeta}>View Discussion</Text>
          </Pressable>
        ))}
        <View style={{ height: 50 }} />
      </View>
      </ScrollView>
    </View>
  );
}

const styles = createThemedStyles({
  page: { flex: 1, width: "100%", backgroundColor: "#121212" },
  topBar: { width: "100%", backgroundColor: "#121212", borderBottomWidth: 1, borderBottomColor: "#292929", zIndex: 2 },
  topBarInner: { minHeight: 58, width: "100%", alignSelf: "center", justifyContent: "center", paddingHorizontal: 20 },
  backButton: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 9, minHeight: 42, paddingHorizontal: 12, borderRadius: 13, backgroundColor: "#1e1e1e" },
  blockedBackButton: { position: "absolute", top: 20, left: 20 },
  backText: { fontSize: 14, fontWeight: "700" },
  detailScroll: { flex: 1, width: "100%", backgroundColor: "transparent" },
  detailScrollContent: { width: "100%", paddingBottom: 20 },
  content: { width: "100%", paddingHorizontal: 20, paddingBottom: 20, backgroundColor: "#121212" },
  hero: { position: "relative", width: "100%", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 18, backgroundColor: "#1e1e1e", marginTop: 14 },
  heroBlur: { position: "absolute", top: -30, left: -30, right: -30, bottom: -30, opacity: 0.72 },
  heroShade: { ...StyleSheet.absoluteFillObject },
  banner: { width: "100%", height: "100%" },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  title: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  meta: { color: "#f5c518", fontSize: 13, marginTop: 4 },
  shareButton: { backgroundColor: "#1e1e1e", padding: 12, borderRadius: 50 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statusTab: { flex: 1, padding: 10, backgroundColor: '#1e1e1e', borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  statusTabActive: { backgroundColor: '#f5c518', borderColor: '#f5c518' },
  statusTabText: { color: '#aaa', textAlign: 'center', fontSize: 10, fontWeight: 'bold' },
  statusTabTextActive: { color: '#000' },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "bold", marginTop: 25, marginBottom: 12 },
  screenshot: { width: 240, height: 135, borderRadius: 10, marginRight: 12 },
  ratingBox: { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12 },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  ratingLabel: { color: '#aaa', fontSize: 9, width: 80 },
  barBackground: { flex: 1, height: 6, backgroundColor: '#333', borderRadius: 3, marginHorizontal: 10 },
  barFill: { height: '100%', backgroundColor: '#f5c518', borderRadius: 3 },
  ratingPercent: { color: '#fff', fontSize: 10, width: 30 },
  desc: { color: "#ccc", fontSize: 14, lineHeight: 22 },
  reqBox: { backgroundColor: "#1e1e1e", padding: 15, borderRadius: 10, marginTop: 5 },
  reqText: { color: "#888", fontSize: 12, lineHeight: 18 },
  reviewInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e', borderRadius: 12, padding: 10, marginBottom: 20 },
  reviewInput: { flex: 1, color: '#fff', maxHeight: 80 },
  sendBtn: { backgroundColor: '#f5c518', padding: 10, borderRadius: 10, marginLeft: 10 },
  reviewCard: { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, marginBottom: 10 },
  reviewUser: { color: '#f5c518', fontWeight: 'bold', fontSize: 12, marginBottom: 5 },
  reviewText: { color: '#ccc', fontSize: 13 },
  redditCard: { backgroundColor: '#1a1a1a', padding: 15, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#333' },
  redditTitle: { color: '#fff', fontSize: 13, marginBottom: 5 },
  redditMeta: { color: '#f5c518', fontSize: 10, fontWeight: 'bold' }
});
