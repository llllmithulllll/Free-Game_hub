import { getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  browserLocalPersistence,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
} from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use browser storage for normal website sessions. Static rendering can run
// without a browser, so keep auth in memory in that environment.
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence:
      typeof window === "undefined"
        ? inMemoryPersistence
        : browserLocalPersistence,
  });
} catch {
  // Fast Refresh can re-evaluate this module after Firebase Auth was created.
  auth = getAuth(app);
}

const db: Firestore = getFirestore(app);

export { auth, db };
