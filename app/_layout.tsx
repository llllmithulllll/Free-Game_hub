import { auth, db } from "@/lib/firebase";
import { ThemeProvider, useAppTheme } from "@/lib/theme";
import GamePalLoader from "../components/GamePalLoader";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const segments = useSegments();
  const root = segments[0];
  const route = segments[1];
  const isAuthenticatedAppRoute =
    root === "(tabs)" ||
    ["preferences", "appearance", "pc-compatibility", "details", "edit-profile", "friend-profile", "my-games"].includes(root ?? "");

  useEffect(() => {
    // Expo Notifications exposes these response APIs on native platforms only.
    // Skip the listener setup on web, where notification navigation is not wired.
    if (Platform.OS === "web") return;

    const openNotificationRoute = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (typeof url === "string") router.push(url as never);
    };
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse?.notification) openNotificationRoute(lastResponse.notification);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotificationRoute(response.notification);
    });
    return () => subscription.remove();
  }, [router]);
  const isPublicWebRoute =
    Platform.OS === "web" &&
    ((root === "(tabs)" && (!route || ["index", "free_now"].includes(route))) ||
      root === "details");

  // Public discovery routes render during web static generation. Private
  // routes and native screens still wait for Firebase's auth state.
  const [loading, setLoading] = useState(!isPublicWebRoute);
  const [isAuthReady, setIsAuthReady] = useState(isPublicWebRoute);

  // Tracks which signed-in user we've already fetched preferences for, so we
  // don't re-hit Firestore on every navigation (useSegments() returns a new
  // array reference on every route change, which used to re-run this whole
  // check each time).
  const lastCheckedUid = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        lastCheckedUid.current = null;
        // Allow visitors to browse games, details, and giveaways on the web.
        // Account features remain behind the existing login gate.
        if (
          !isPublicWebRoute &&
          root !== "login" &&
          root !== "signup"
        ) {
          router.replace("/login");
        }
        setLoading(false);
        setIsAuthReady(true);
        return;
      }

      // Firebase briefly signs a newly-created account in before signup
      // sends verification and signs it back out. Keep signup on its own
      // screen during that transient auth event; onboarding starts after a
      // verified user explicitly logs in.
      if (root === "signup") {
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

      // Google accounts may be created without an in-app username or date of
      // birth. Collect those before preferences so every account has the data
      // used by friend search and age-aware content filtering.
      try {
        const profileSnap = await getDoc(doc(db, "users", user.uid));
        const profile = profileSnap.exists() ? profileSnap.data() : {};
        if ((!profile.username || !profile.dateOfBirth) && root !== "edit-profile") {
          router.replace({ pathname: "/edit-profile", params: { completeProfile: "1" } });
          lastCheckedUid.current = user.uid;
          return;
        }

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
          if (!isAuthenticatedAppRoute) {
            // If prefs and profile setup exist and user is on an auth screen, move to tabs.
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
  }, [isPublicWebRoute, isAuthenticatedAppRoute, root, segments, router]);

  if (loading || !isAuthReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <GamePalLoader size={170} label="Getting GamePal ready" variant="startup" />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={colors.statusBar} />
        <Stack screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          animationDuration: 220,
          contentStyle: { backgroundColor: colors.background },
        }} />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
