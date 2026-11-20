import { doc, getDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";

export type SignedInDestination = "/(tabs)" | "/preferences" | "complete-profile";

export async function getSignedInDestination(user: User): Promise<SignedInDestination> {
  const [profile, preferences] = await Promise.all([
    getDoc(doc(db, "users", user.uid)),
    getDoc(doc(db, "users", user.uid, "preferences", "data")),
  ]);
  const data = profile.exists() ? profile.data() : {};
  if (!data.username || !data.dateOfBirth) return "complete-profile";
  if (!preferences.exists()) return "/preferences";
  return "/(tabs)";
}
