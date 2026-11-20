import { auth } from "@/lib/firebase";
import { createThemedStyles, themeColors, useAppTheme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import React, { useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { getSignedInDestination } from "@/lib/auth-routing";

export default function Login() {
  const { resolvedMode } = useAppTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");

  const router = useRouter();

  const finishGoogleSignIn = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Google sign-in completed without an authenticated user.");
    try {
      const destination = await getSignedInDestination(user);
      if (destination === "complete-profile") router.replace({ pathname: "/edit-profile", params: { completeProfile: "1" } });
      else router.replace(destination);
    } catch (error) {
      // If onboarding data cannot be read temporarily, let the root auth gate retry it.
      router.replace("/(tabs)");
      console.warn("Could not resolve Google sign-in destination:", error);
    }
  };

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
            <Ionicons name="alert-circle-outline" size={60} color={themeColors.danger} />
            <Text style={styles.modalTitle}>Login Failed</Text>
            <Text style={styles.modalSubtitle}>{alertMsg}</Text>
            <Pressable style={[styles.modalButton, { backgroundColor: '#ff4444' }]} onPress={() => setAlertVisible(false)}>
              <Text style={styles.buttonText}>Try Again</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.authCard}>
          <Image
            source={resolvedMode === "dark"
              ? require("@/assets/gamepal/logo-pack/png/gamepal-logo-white-transparent-1024.png")
              : require("@/assets/gamepal/logo-pack/png/gamepal-logo-black-transparent-1024.png")}
            accessibilityLabel="GamePal"
            resizeMode="contain"
            style={styles.brandLogo}
          />
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to find your next favorite game.</Text>

          <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} placeholderTextColor={themeColors.muted} keyboardType="email-address" autoCapitalize="none" />

          <View style={styles.passwordContainer}>
            <TextInput placeholder="Password" value={password} onChangeText={setPassword} style={styles.passwordInput} secureTextEntry={!showPassword} placeholderTextColor={themeColors.muted} />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={themeColors.muted} />
            </Pressable>
          </View>

          <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color={themeColors.onAccent} /> : <Text style={styles.buttonText}>Login</Text>}
          </Pressable>

          <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>or</Text><View style={styles.dividerLine} /></View>
          <GoogleSignInButton disabled={loading} onSuccess={finishGoogleSignIn} onError={(message) => { setAlertMsg(message); setAlertVisible(true); }} />

          <Pressable onPress={() => router.push("/signup")}>
            <Text style={styles.linkText}>New gamer here? <Text style={styles.linkTextBold}>Create Account</Text></Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = createThemedStyles({
  container: { flex: 1, backgroundColor: "#121212" },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  authCard: { width: "100%", maxWidth: 460, backgroundColor: "#1e1e1e", borderRadius: 22, padding: 30, borderWidth: 1, borderColor: "#333" },
  brandLogo: { width: 132, height: 132, alignSelf: "center", marginBottom: -2 },
  title: { color: "#fff", fontSize: 28, fontWeight: "bold", marginBottom: 8, textAlign: "center" },
  subtitle: { color: "#aaa", fontSize: 14, textAlign: "center", marginBottom: 28 },
  input: { width: "100%", height: 52, backgroundColor: "#252525", color: "#fff", paddingHorizontal: 15, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: "#333" },
  passwordContainer: { width: "100%", height: 52, flexDirection: 'row', alignItems: 'center', backgroundColor: "#252525", borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: "#333" },
  passwordInput: { flex: 1, color: "#fff", padding: 15 },
  eyeIcon: { paddingHorizontal: 15 },
  button: { backgroundColor: "#f5c518", padding: 15, borderRadius: 10, marginTop: 10 },
  buttonText: { textAlign: "center", fontWeight: "bold", color: "#000", fontSize: 16 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#444" },
  dividerText: { color: "#aaa", fontSize: 13 },
  linkText: { color: "#f5c518", textAlign: "center", marginTop: 25, fontSize: 14 },
  linkTextBold: { fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1e1e1e', padding: 30, borderRadius: 20, alignItems: 'center', width: '85%', borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 15 },
  modalSubtitle: { color: '#aaa', textAlign: 'center', marginTop: 10, marginBottom: 20 },
  modalButton: { paddingVertical: 10, paddingHorizontal: 30, borderRadius: 8 }
});
