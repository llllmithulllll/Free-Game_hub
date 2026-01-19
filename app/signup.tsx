import { auth } from "@/lib/firebase";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function Signup() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!email || !password) {
      alert("Please fill all fields");
      return;
    }

    try {
      setLoading(true);

      // 1️⃣ Create account
      await createUserWithEmailAndPassword(auth, email, password);

      // 2️⃣ Force logout (so user must login manually)
      await signOut(auth);

      // 3️⃣ Go to login page
      router.replace("/login");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#aaa"
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="#aaa"
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={handleSignup}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Creating..." : "Sign Up"}
        </Text>
      </Pressable>

      {/* 🔁 Link to Login */}
      <Pressable onPress={() => router.replace("/login")}>
        <Text style={styles.link}>
          Already have an account? <Text style={styles.linkBold}>Login</Text>
        </Text>
      </Pressable>
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
    justifyContent: "center",
  },

  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },

  input: {
    backgroundColor: "#1e1e1e",
    color: "#fff",
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 15,
  },

  button: {
    backgroundColor: "#f5c518",
    padding: 14,
    borderRadius: 8,
    marginTop: 6,
  },

  buttonText: {
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 15,
    color: "#000",
  },

  link: {
    color: "#aaa",
    textAlign: "center",
    marginTop: 20,
    fontSize: 13,
  },

  linkBold: {
    color: "#f5c518",
    fontWeight: "bold",
  },
});
