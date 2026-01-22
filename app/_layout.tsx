import { auth, db } from "@/lib/firebase";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false); // New state to track stability

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const root = segments[0];

      if (!user) {
        // Only redirect to login if we are not already on an auth screen
        if (root !== "login" && root !== "signup") {
          router.replace("/login");
        }
        setLoading(false);
        setIsAuthReady(true);
        return;
      }

      // If user exists, check for preferences
      try {
        const prefRef = doc(db, "users", user.uid, "preferences", "data");
        const prefSnap = await getDoc(prefRef);

        if (!prefSnap.exists()) {
          // If no prefs, force them to the preferences screen
          if (root !== "preferences") {
            router.replace("/preferences");
          }
        } else {
          // If prefs exist and they are stuck on auth/loading screens, move to tabs
          if (root !== "(tabs)" && root !== "preferences") {
            router.replace("/(tabs)");
          }
        }
      } catch (error) {
        console.error("Layout Pref Check Error:", error);
      } finally {
        setLoading(false);
        setIsAuthReady(true);
      }
    });

    return unsubscribe;
  }, [segments]); // Keep segments to re-run logic on navigation

  if (loading || !isAuthReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#121212" }}>
        <ActivityIndicator size="large" color="#f5c518" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#121212" }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaView>
  );
}