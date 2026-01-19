import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/* ---------------- CONFIG ---------------- */

const firebaseConfig = {
  apiKey: "AIzaSyAOtObYNLV_5XgechkHrtwGw_XkK1AMAZw",
  authDomain: "gamehub-1322d.firebaseapp.com",
  projectId: "gamehub-1322d",
  storageBucket: "gamehub-1322d.firebasestorage.app",
  messagingSenderId: "843797453071",
  appId: "1:843797453071:web:32b90b551e584c56ce867a",
  measurementId: "G-60HVXMWSQH"
};

/* ---------------- INIT ---------------- */

const app = initializeApp(firebaseConfig);

/* ---------------- AUTH ---------------- */
// ✅ DO NOT use react-native persistence yet
export const auth = getAuth(app);

/* ---------------- DATABASE ---------------- */

export const db = getFirestore(app);
