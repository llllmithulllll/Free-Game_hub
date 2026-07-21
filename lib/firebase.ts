import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  getAuth,
  getReactNativePersistence,
  initializeAuth
} from "firebase/auth";
import {
  Firestore,
  getFirestore,
  initializeFirestore
} from "firebase/firestore";

/* ---------------- CONFIG ---------------- */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

/* ---------------- INIT ---------------- */
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/* ---------------- AUTH ---------------- */
// initializeAuth() throws "Auth has already been initialized" if it's called
// more than once for the same app instance. This happens routinely during
// Expo/Metro Fast Refresh in dev, and would otherwise crash the whole app.
// Falling back to getAuth() reuses the existing instance instead of throwing.
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch (error) {
  auth = getAuth(app);
}

export { auth };

/* ---------------- DATABASE ---------------- */
// `persistentLocalCache` + `persistentMultipleTabManager` are Web-only APIs —
// they depend on IndexedDB for storage and localStorage-based "leader
// election" to coordinate cache ownership across browser tabs. Neither of
// those exist in React Native. Configuring them here caused Firestore to try
// (and fail) to negotiate that browser-only cache/tab setup, which could hang
// reads and writes indefinitely instead of failing fast — showing up as
// screens stuck on a loading spinner forever.
//
// There's no official offline-persistence equivalent for the Firestore JS SDK
// on native platforms (that requires the separate @react-native-firebase/firestore
// package). So here we just use the default in-memory cache, and turn on
// long-polling auto-detection, since gRPC-style streaming connections are a
// common source of hangs over React Native's networking stack.
let db: Firestore;
try {
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true
  });
} catch (error) {
  db = getFirestore(app);
}

export { db };
