import { auth } from "@/lib/firebase";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const inTabs = segments[0] === "(tabs)";

      if (!user && inTabs) {
        router.replace("/login");
      }

      if (user && !inTabs) {
        router.replace("/(tabs)");
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [segments]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#121212",
        }}
      >
        <ActivityIndicator size="large" color="#f5c518" />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#121212" }}
      edges={["top", "left", "right"]}
    >
      {/* Status bar styling */}
      <StatusBar style="light" backgroundColor="#121212" />

      {/* App navigation */}
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaView>
  );
}
