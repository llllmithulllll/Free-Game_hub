import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1e1e1e", // Matches your app theme
          borderTopWidth: 1,
          borderTopColor: "#333",
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: "#f5c518", // Theme yellow accent
        tabBarInactiveTintColor: "#888",
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "bold",
        },
      }}
    >
      {/* VISIBLE TABS */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="game-controller" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="free_now"
        options={{
          title: "Giveaways",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="gift" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />

      {/* 🚫 HIDDEN TABS */}
      {/* Setting href: null hides them from the bottom bar UI */}
      <Tabs.Screen
        name="details"
        options={{
          href: null, // Hides the tab
        }}
      />
      <Tabs.Screen
        name="preferences"
        options={{
          href: null, // Hides the tab
        }}
      />
      {/* If you have giveaway_details.tsx in this folder, hide it too */}
      <Tabs.Screen
        name="giveaway_details"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}