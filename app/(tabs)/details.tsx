import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
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
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function Details() {
  const { id } = useLocalSearchParams();
  const [game, setGame] = useState<any>(null);
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [userReview, setUserReview] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

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
      const apiKey = process.env.EXPO_PUBLIC_RAWG_API_KEY;
      
      const res = await fetch(`https://api.rawg.io/api/games/${id}?key=${apiKey}`);
      const data = await res.json();
      
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

      // ✅ GLOBAL BACKEND CACHE STORAGE
      // Seed the global database so this game appears in searches for others
      await setDoc(doc(db, "global_games", id as string), {
        id: id as string,
        title: gameObj.title,
        searchName: gameObj.title.toLowerCase(),
        thumbnail: gameObj.thumbnail,
        genre: gameObj.firstGenre,
        updatedAt: serverTimestamp()
      }, { merge: true });

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

  if (loading || !game) return <ActivityIndicator style={{ flex: 1 }} color="#f5c518" />;

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: game.thumbnail }} style={styles.banner} />
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{game.title}</Text>
            <Text style={styles.meta}>{game.genre}</Text>
          </View>
          <Pressable style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share-social" size={20} color="#f5c518" />
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
            placeholderTextColor="#666" 
            value={userReview} 
            onChangeText={setUserReview} 
            multiline 
          />
          <Pressable style={styles.sendBtn} onPress={submitReview}>
            <Ionicons name="send" size={18} color="#000" />
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  banner: { width: "100%", height: 250 },
  content: { padding: 20 },
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