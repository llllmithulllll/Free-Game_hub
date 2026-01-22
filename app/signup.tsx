import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); 
  const [loading, setLoading] = useState(false);

  // --- Unified Alert State ---
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    icon: "alert-circle" as any,
    color: "#f5c518",
    isSuccess: false
  });

  const router = useRouter();

  const showAlert = (title: string, message: string, type: 'error' | 'success') => {
    setAlertConfig({
      title,
      message,
      icon: type === 'success' ? 'mail-unread-outline' : 'alert-circle-outline',
      color: type === 'success' ? '#f5c518' : '#ff4444',
      isSuccess: type === 'success'
    });
    setAlertVisible(true);
  };

  const handleSignup = async () => {
    if (!email || !password || !name || !confirmPassword) {
      showAlert("Missing Fields", "Please fill in all details to create your account.", "error");
      return;
    }
    if (password !== confirmPassword) {
      showAlert("Passwords Mismatch", "The passwords you entered do not match.", "error");
      return;
    }

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);

      await setDoc(doc(db, "users", userCredential.user.uid), {
        displayName: name.trim(),
        email: email.toLowerCase(),
        createdAt: serverTimestamp(),
      });

      await signOut(auth);
      showAlert("Verify Your Email", `We sent a link to ${email}. Please check your inbox!`, "success");
    } catch (error: any) {
      let msg = "Credentials aren't right. Please try again.";
      if (error.code === 'auth/email-already-in-use') msg = "This email is already registered.";
      else if (error.code === 'auth/invalid-email') msg = "That email address is not valid.";
      
      showAlert("Signup Failed", msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* --- UNIFIED THEMED MODAL --- */}
      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name={alertConfig.icon} size={60} color={alertConfig.color} />
            <Text style={styles.modalTitle}>{alertConfig.title}</Text>
            <Text style={styles.modalSubtitle}>{alertConfig.message}</Text>
            <Pressable 
              style={[styles.modalButton, { backgroundColor: alertConfig.color }]} 
              onPress={() => {
                setAlertVisible(false);
                if (alertConfig.isSuccess) router.replace("/login");
              }}
            >
              <Text style={styles.buttonText}>Got it!</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Text style={styles.title}>Create Account</Text>
      
      <TextInput placeholder="Full Name" value={name} onChangeText={setName} style={styles.input} placeholderTextColor="#aaa" />
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} placeholderTextColor="#aaa" keyboardType="email-address" autoCapitalize="none" />

      <View style={styles.passwordContainer}>
        <TextInput placeholder="Password" value={password} onChangeText={setPassword} style={styles.passwordInput} secureTextEntry={!showPassword} placeholderTextColor="#aaa" />
        <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
          <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#aaa" />
        </Pressable>
      </View>

      <View style={styles.passwordContainer}>
        <TextInput placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} style={styles.passwordInput} secureTextEntry={!showPassword} placeholderTextColor="#aaa" />
        <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
          <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#aaa" />
        </Pressable>
      </View>
      
      <Pressable style={styles.button} onPress={handleSignup} disabled={loading}>
        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Sign Up</Text>}
      </Pressable>

      <Pressable onPress={() => router.push("/login")}>
        <Text style={styles.linkText}>Already have an account? <Text style={styles.linkTextBold}>Login</Text></Text>
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
  modalContent: { backgroundColor: '#1e1e1e', padding: 30, borderRadius: 20, alignItems: 'center', width: '90%', borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 15 },
  modalSubtitle: { color: '#aaa', textAlign: 'center', marginTop: 10, marginBottom: 25, lineHeight: 22 },
  modalButton: { paddingVertical: 12, paddingHorizontal: 40, borderRadius: 10 }
});