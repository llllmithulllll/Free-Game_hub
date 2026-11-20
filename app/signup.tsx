import { auth, db } from "@/lib/firebase";
import { createThemedStyles, themeColors, useAppTheme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, sendEmailVerification, signOut, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { ageFromDateOfBirth } from "@/lib/content-filter";
import { getPasswordRequirements, isPasswordAcceptable } from "@/lib/password-policy";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { getSignedInDestination } from "@/lib/auth-routing";
import React, { useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

export default function Signup() {
  const { resolvedMode } = useAppTheme();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
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
  const passwordRequirements = getPasswordRequirements(password);

  const finishGoogleSignIn = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Google sign-in completed without an authenticated user.");
    try {
      const destination = await getSignedInDestination(user);
      if (destination === "complete-profile") router.replace({ pathname: "/edit-profile", params: { completeProfile: "1" } });
      else router.replace(destination);
    } catch (error) {
      router.replace("/(tabs)");
      console.warn("Could not resolve Google sign-in destination:", error);
    }
  };

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
    if (!email || !password || !name || !username || !confirmPassword || !dateOfBirth) {
      showAlert("Missing Fields", "Please fill in all details to create your account.", "error");
      return;
    }
    const usernameLower = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(usernameLower)) {
      showAlert("Invalid Username", "Use 3–20 letters, numbers, or underscores.", "error");
      return;
    }
    const age = ageFromDateOfBirth(dateOfBirth);
    if (age === null) {
      showAlert("Check Your Date of Birth", "Enter a real date in YYYY-MM-DD format that is not in the future.", "error");
      return;
    }
    if (password !== confirmPassword) {
      showAlert("Passwords Mismatch", "The passwords you entered do not match.", "error");
      return;
    }
    if (!isPasswordAcceptable(password)) {
      showAlert("Choose a stronger password", "Use at least 8 characters, including at least one letter and one number.", "error");
      return;
    }

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name.trim() });
      await sendEmailVerification(userCredential.user);

      await setDoc(doc(db, "users", userCredential.user.uid), {
        displayName: name.trim(),
        username: username.trim(),
        usernameLower,
        email: email.toLowerCase(),
        dateOfBirth: Timestamp.fromDate(new Date(`${dateOfBirth}T00:00:00.000Z`)),
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "publicProfiles", userCredential.user.uid), {
        displayName: name.trim(),
        username: username.trim(),
        usernameLower,
        updatedAt: serverTimestamp(),
      });

      await signOut(auth);
      showAlert("Verify Your Email", `We sent a link to ${email}. Please check your inbox or spam folder!`, "success");
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
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join the community and build your game library.</Text>
      
      <TextInput placeholder="Full Name" value={name} onChangeText={setName} style={styles.input} placeholderTextColor={themeColors.muted} />
      <TextInput placeholder="Username" value={username} onChangeText={setUsername} style={styles.input} placeholderTextColor={themeColors.muted} autoCapitalize="none" />
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} placeholderTextColor={themeColors.muted} keyboardType="email-address" autoCapitalize="none" />
      <TextInput
        placeholder="Date of birth (YYYY-MM-DD)"
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
        style={styles.input}
        placeholderTextColor={themeColors.muted}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <Text style={styles.ageHint}>We calculate your age from your birth date. Sexual-content filtering stays on for under-18 accounts.</Text>
      {dateOfBirth.length === 10 && ageFromDateOfBirth(dateOfBirth) !== null && (
        <Text style={styles.ageText}>Age: {ageFromDateOfBirth(dateOfBirth)}</Text>
      )}

      <View style={styles.passwordContainer}>
        <TextInput placeholder="Password" value={password} onChangeText={setPassword} style={styles.passwordInput} secureTextEntry={!showPassword} placeholderTextColor={themeColors.muted} />
        <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
          <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={themeColors.muted} />
        </Pressable>
      </View>
      <View style={styles.passwordRequirements}>
        {passwordRequirements.map(({ label, met }) => (
          <View key={label} style={styles.requirementRow}>
            <Ionicons name={met ? "checkmark-circle" : "ellipse-outline"} size={15} color={met ? "#2eae68" : themeColors.muted} />
            <Text style={[styles.requirementText, met && styles.requirementMet]}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.passwordContainer}>
        <TextInput placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} style={styles.passwordInput} secureTextEntry={!showPassword} placeholderTextColor={themeColors.muted} />
        <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
          <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={themeColors.muted} />
        </Pressable>
      </View>
      
      <Pressable style={styles.button} onPress={handleSignup} disabled={loading}>
        {loading ? <ActivityIndicator color={themeColors.onAccent} /> : <Text style={styles.buttonText}>Sign Up</Text>}
      </Pressable>

      <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>or</Text><View style={styles.dividerLine} /></View>
      <GoogleSignInButton disabled={loading} onSuccess={finishGoogleSignIn} onError={(message) => showAlert("Google sign-in unavailable", message, "error")} />

      <Pressable onPress={() => router.push("/login")}>
        <Text style={styles.linkText}>Already have an account? <Text style={styles.linkTextBold}>Login</Text></Text>
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
  authCard: { width: "100%", maxWidth: 500, backgroundColor: "#1e1e1e", borderRadius: 22, padding: 28, borderWidth: 1, borderColor: "#333" },
  brandLogo: { width: 118, height: 118, alignSelf: "center", marginBottom: -2 },
  title: { color: "#fff", fontSize: 28, fontWeight: "bold", marginBottom: 7, textAlign: "center" },
  subtitle: { color: "#aaa", fontSize: 13, textAlign: "center", marginBottom: 22 },
  input: { width: "100%", height: 48, backgroundColor: "#252525", color: "#fff", paddingHorizontal: 14, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: "#333" },
  ageText: { color: "#aaa", fontSize: 13, marginTop: -8, marginBottom: 12, marginLeft: 4 },
  ageHint: { color: "#777", fontSize: 11, lineHeight: 16, marginTop: -8, marginBottom: 10, marginHorizontal: 4 },
  passwordContainer: { width: "100%", height: 48, flexDirection: 'row', alignItems: 'center', backgroundColor: "#252525", borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: "#333" },
  passwordInput: { flex: 1, color: "#fff", paddingHorizontal: 14, height: "100%" },
  passwordRequirements: { marginTop: -4, marginBottom: 8, marginLeft: 4, gap: 4 },
  requirementRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  requirementText: { color: "#999", fontSize: 12 },
  requirementMet: { color: "#2eae68" },
  eyeIcon: { paddingHorizontal: 15 },
  button: { backgroundColor: "#f5c518", padding: 15, borderRadius: 10, marginTop: 10 },
  buttonText: { textAlign: "center", fontWeight: "bold", color: "#000", fontSize: 16 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#444" },
  dividerText: { color: "#aaa", fontSize: 13 },
  linkText: { color: "#f5c518", textAlign: "center", marginTop: 25, fontSize: 14 },
  linkTextBold: { fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1e1e1e', padding: 30, borderRadius: 20, alignItems: 'center', width: '90%', borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 15 },
  modalSubtitle: { color: '#aaa', textAlign: 'center', marginTop: 10, marginBottom: 25, lineHeight: 22 },
  modalButton: { paddingVertical: 12, paddingHorizontal: 40, borderRadius: 10 }
});
