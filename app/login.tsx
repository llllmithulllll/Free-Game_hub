import { auth } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import React, { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");

  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      setAlertMsg("Please enter both your email and password.");
      setAlertVisible(true);
      return;
    }

    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // ✅ Link-based Verification Gatekeeper
      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        setAlertMsg("Account Not Active. Please check your email and click the verification link.");
        setAlertVisible(true);
        return;
      }

      router.replace("/(tabs)");
    } catch (error: any) {
      setAlertMsg("Credentials aren't right. Please check your email and password.");
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* THEMED ERROR MODAL */}
      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="alert-circle-outline" size={60} color="#ff4444" />
            <Text style={styles.modalTitle}>Login Failed</Text>
            <Text style={styles.modalSubtitle}>{alertMsg}</Text>
            <Pressable style={[styles.modalButton, { backgroundColor: '#ff4444' }]} onPress={() => setAlertVisible(false)}>
              <Text style={styles.buttonText}>Try Again</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Text style={styles.title}>Welcome Back</Text>
      
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} placeholderTextColor="#aaa" keyboardType="email-address" autoCapitalize="none" />

      <View style={styles.passwordContainer}>
        <TextInput placeholder="Password" value={password} onChangeText={setPassword} style={styles.passwordInput} secureTextEntry={!showPassword} placeholderTextColor="#aaa" />
        <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
          <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#aaa" />
        </Pressable>
      </View>
      
      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Login</Text>}
      </Pressable>

      <Pressable onPress={() => router.push("/signup")}>
        <Text style={styles.linkText}>New gamer here? <Text style={styles.linkTextBold}>Create Account</Text></Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212", padding: 20, justifyContent: "center" },
  title: { color: "#fff", fontSize: 28, fontWeight: "bold", marginBottom: 30, textAlign: "center" },
  input: { backgroundColor: "#1e1e1e", color: "#fff", padding: 15, borderRadius: 10, marginBottom: 15 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#1e1e1e", borderRadius: 10, marginBottom: 15 },
  passwordInput: { flex: 1, color: "#fff", padding: 15 },
  eyeIcon: { paddingHorizontal: 15 },
  button: { backgroundColor: "#f5c518", padding: 15, borderRadius: 10, marginTop: 10 },
  buttonText: { textAlign: "center", fontWeight: "bold", color: "#000", fontSize: 16 },
  linkText: { color: "#f5c518", textAlign: "center", marginTop: 25, fontSize: 14 },
  linkTextBold: { fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1e1e1e', padding: 30, borderRadius: 20, alignItems: 'center', width: '85%', borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 15 },
  modalSubtitle: { color: '#aaa', textAlign: 'center', marginTop: 10, marginBottom: 20 },
  modalButton: { paddingVertical: 10, paddingHorizontal: 30, borderRadius: 8 }
});