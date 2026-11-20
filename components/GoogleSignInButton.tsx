import { auth } from "@/lib/firebase";
import { createThemedStyles, useAppTheme } from "@/lib/theme";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";

WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "not-configured.apps.googleusercontent.com";
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "not-configured.apps.googleusercontent.com";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "not-configured.apps.googleusercontent.com";

type Props = {
  disabled?: boolean;
  onSuccess: () => void | Promise<void>;
  onError: (message: string) => void;
};

export default function GoogleSignInButton({ disabled = false, onSuccess, onError }: Props) {
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const responseHandled = useRef(false);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: ANDROID_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    selectAccount: true,
  });

  useEffect(() => {
    if (Platform.OS === "web" || !response || responseHandled.current) return;
    if (response.type !== "success") {
      if (response.type === "error") onErrorRef.current(response.error?.message || "Google sign-in could not complete.");
      setLoading(false);
      return;
    }
    responseHandled.current = true;
    const idToken = response.params.id_token;
    if (!idToken) {
      setLoading(false);
      onErrorRef.current("Google did not return an ID token. Check your OAuth client setup.");
      return;
    }
    void signInWithCredential(auth, GoogleAuthProvider.credential(idToken))
      .then(() => onSuccessRef.current())
      .catch((error: any) => onErrorRef.current(error?.message || "Could not sign in with Google."))
      .finally(() => setLoading(false));
  }, [response]);

  const startSignIn = async () => {
    const configured = Platform.OS === "web"
      ? !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
      : Platform.OS === "ios"
        ? !!process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
        : !!process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
    if (!configured) {
      onError("Google sign-in needs the platform OAuth client ID in your local .env. See README.md for setup.");
      return;
    }
    if (Platform.OS === "web") {
      setLoading(true);
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await signInWithPopup(auth, provider);
        await onSuccessRef.current();
      } catch (error: any) {
        onErrorRef.current(error?.code === "auth/unauthorized-domain"
          ? "Add this website's domain to Firebase Authentication's authorized domains."
          : error?.message || "Could not sign in with Google.");
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!request) {
      onError("Google sign-in is still preparing. Please try again in a moment.");
      return;
    }
    responseHandled.current = false;
    setLoading(true);
    try {
      const result = await promptAsync();
      if (result.type === "cancel" || result.type === "dismiss") setLoading(false);
      else if (result.type === "error") {
        setLoading(false);
        onErrorRef.current(result.error?.message || "Google sign-in could not complete.");
      }
    } catch (error: any) {
      setLoading(false);
      onErrorRef.current(error?.message || "Could not open Google sign-in.");
    }
  };

  return (
    <Pressable accessibilityRole="button" onPress={startSignIn} disabled={disabled || loading} style={[styles.button, { borderColor: colors.border, opacity: disabled ? 0.65 : 1 }]}>
      {loading ? <ActivityIndicator color="#202124" /> : <View style={styles.googleMark}><Text style={styles.googleG}>G</Text></View>}
      <Text style={styles.buttonText}>{loading ? "Connecting to Google…" : "Continue with Google"}</Text>
      <View style={{ width: 20 }} />
    </Pressable>
  );
}

const styles = createThemedStyles({
  button: { minHeight: 50, width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, backgroundColor: "#fff", borderWidth: 1, borderRadius: 10, marginTop: 12 },
  googleMark: { width: 20, alignItems: "center" },
  googleG: { color: "#4285F4", fontSize: 19, fontWeight: "900" },
  buttonText: { color: "#202124", fontSize: 14, fontWeight: "700" },
});
