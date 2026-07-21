import { auth, db } from "@/lib/firebase";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false); // New state to track stability

  // Tracks which signed-in user we've already fetched preferences for, so we
  // don't re-hit Firestore on every navigation (useSegments() returns a new
  // array reference on every route change, which used to re-run this whole
  // check each time).
  const lastCheckedUid = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const root = segments[0];

      if (!user) {
        lastCheckedUid.current = null;
        // Only redirect to login if we are not already on an auth screen
        if (root !== "login" && root !== "signup") {
          router.replace("/login");
        }
        setLoading(false);
        setIsAuthReady(true);
        return;
      }

      // Already validated this user this session — just make sure we're not
      // stuck on a loading screen, without re-reading Firestore.
      if (lastCheckedUid.current === user.uid) {
        setLoading(false);
        setIsAuthReady(true);
        return;
      }

      // If user exists, check for preferences
      try {
        const prefRef = doc(db, "users", user.uid, "preferences", "data");
        let prefSnap;
        try {
          prefSnap = await getDoc(prefRef);
        } catch (readError: any) {
          // Right after sign-in, Firestore's very first request can
          // occasionally fire before the fresh ID token is fully attached,
          // causing a transient "permission-denied" even with correct
          // rules. Force a token refresh and retry once before giving up.
          if (readError?.code === "permission-denied") {
            await user.getIdToken(true);
            prefSnap = await getDoc(prefRef);
          } else {
            throw readError;
          }
        }
        lastCheckedUid.current = user.uid;

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
