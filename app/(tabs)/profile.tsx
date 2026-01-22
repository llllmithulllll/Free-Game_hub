import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function Profile() {
  const [claimedGames, setClaimedGames] = useState<any[]>([]);
  const [userName, setUserName] = useState("Gamer");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // --- States for Themed Removal ---
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- States for Editing Name ---
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      router.replace("/login");
      return;
    }

    const fetchUser = async () => {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserName(data.displayName || "Gamer");
        setNewName(data.displayName || "Gamer");
      }
    };
    fetchUser();

    const q = query(collection(db, "users", user.uid, "claimedGames"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const games = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setClaimedGames(games);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- Handler for Name Update ---
  const handleUpdateName = async () => {
    if (!newName.trim() || !auth.currentUser) return;

    try {
      setIsUpdatingName(true);
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        displayName: newName.trim(),
      });
      setUserName(newName.trim());
      setEditModalVisible(false);
    } catch (error) {
      console.error("Error updating name:", error);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const triggerRemove = (gameId: string) => {
    setSelectedGameId(gameId);
    setRemoveModalVisible(true);
  };

  const handleRemoveGame = async () => {
    if (!selectedGameId || !auth.currentUser) return;
    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, "users", auth.currentUser.uid, "claimedGames", selectedGameId));
      setRemoveModalVisible(false);
    } catch (error) {
      console.error("Delete Error:", error);
    } finally {
      setIsDeleting(false);
      setSelectedGameId(null);
    }
  };

  const renderGameItem = ({ item }: { item: any }) => (
    <View style={styles.gameCard}>
      <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
      <View style={styles.gameInfo}>
        <Text style={styles.gameTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.gameGenre}>{item.genre}</Text>
      </View>
      <Pressable onPress={() => triggerRemove(item.id)} style={styles.removeBtn}>
        <Ionicons name="trash-outline" size={20} color="#ff4444" />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* --- THEMED EDIT NAME MODAL --- */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile Name</Text>
            <TextInput
              style={styles.editInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter your name"
              placeholderTextColor="#666"
              autoFocus
            />
            <View style={styles.modalActionRow}>
              <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.saveBtn]} onPress={handleUpdateName} disabled={isUpdatingName}>
                {isUpdatingName ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- THEMED REMOVAL MODAL --- */}
      <Modal visible={removeModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.iconCircle}>
                <Ionicons name="trash-bin-outline" size={40} color="#ff4444" />
            </View>
            <Text style={styles.modalTitle}>Remove Game?</Text>
            <Text style={styles.modalSubtitle}>This will remove the game from your library.</Text>
            <View style={styles.modalActionRow}>
              <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setRemoveModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Keep It</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.deleteBtn]} onPress={handleRemoveGame} disabled={isDeleting}>
                {isDeleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteBtnText}>Remove</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- UPDATED HEADER WITH EDIT OPTION --- */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeText}>Hello,</Text>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{userName}</Text>
            <Pressable onPress={() => setEditModalVisible(true)} style={styles.editIconBtn}>
              <Ionicons name="pencil" size={16} color="#f5c518" />
            </Pressable>
          </View>
        </View>
        <Pressable style={styles.prefBtn} onPress={() => router.push("/preferences")}>
          <Ionicons name="options-outline" size={18} color="#000" />
          <Text style={styles.prefBtnText}>Prefs</Text>
        </Pressable>
      </View>

      <View style={styles.librarySubHeader}>
        <Text style={styles.libraryTitle}>My Library</Text>
        <Text style={styles.headerCount}>{claimedGames.length} Games</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#f5c518" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={claimedGames}
          keyExtractor={(item) => item.id}
          renderItem={renderGameItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>Your library is empty.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212", padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 30 },
  welcomeText: { color: "#aaa", fontSize: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  userName: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  editIconBtn: { marginLeft: 10, padding: 5, backgroundColor: '#1e1e1e', borderRadius: 5 },
  prefBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#f5c518", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  prefBtnText: { color: "#000", fontWeight: "bold", marginLeft: 5, fontSize: 12 },
  
  librarySubHeader: { marginBottom: 15 },
  libraryTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  headerCount: { color: "#f5c518", fontSize: 13, marginTop: 2 },
  
  listContent: { paddingBottom: 100 },
  gameCard: { flexDirection: "row", backgroundColor: "#1e1e1e", borderRadius: 12, padding: 10, marginBottom: 15, alignItems: "center" },
  thumbnail: { width: 80, height: 50, borderRadius: 6 },
  gameInfo: { flex: 1, marginLeft: 15 },
  gameTitle: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  gameGenre: { color: "#aaa", fontSize: 12, marginTop: 2 },
  removeBtn: { padding: 10 },
  emptyText: { color: "#aaa", textAlign: "center", marginTop: 100, fontSize: 16 },

  // --- MODAL STYLES ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#1e1e1e', padding: 25, borderRadius: 24, alignItems: 'center', width: '85%', borderWidth: 1, borderColor: '#333' },
  editInput: { width: '100%', backgroundColor: '#2a2a2a', color: '#fff', padding: 15, borderRadius: 12, marginTop: 20, marginBottom: 20, fontSize: 16 },
  iconCircle: { backgroundColor: 'rgba(255, 68, 68, 0.1)', padding: 20, borderRadius: 50, marginBottom: 10 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  modalSubtitle: { color: '#aaa', textAlign: 'center', marginTop: 10, marginBottom: 25 },
  modalActionRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginHorizontal: 5 },
  cancelBtn: { backgroundColor: '#333' },
  saveBtn: { backgroundColor: '#f5c518' },
  deleteBtn: { backgroundColor: '#ff4444' },
  cancelBtnText: { color: '#fff', fontWeight: 'bold' },
  saveBtnText: { color: '#000', fontWeight: 'bold' },
  deleteBtnText: { color: '#fff', fontWeight: 'bold' }
});