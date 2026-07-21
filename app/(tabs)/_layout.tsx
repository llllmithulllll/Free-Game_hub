import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1e1e1e",
          borderTopWidth: 1,
          borderTopColor: "#333",
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: "#f5c518",
        tabBarInactiveTintColor: "#888",
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "bold",
        },
      }}
    >
      {/* 1. HOME TAB */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="game-controller" size={size} color={color} />
          ),
        }}
      />

      {/* 2. GIVEAWAYS TAB (Restored) */}
      <Tabs.Screen
        name="free_now"
        options={{
          title: "Giveaways",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="gift" size={size} color={color} />
          ),
        }}
      />
      
      {/* 3. PROFILE TAB */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />

      {/* HIDDEN ROUTES (No icons, but accessible via navigation) */}
      <Tabs.Screen
        name="details"
        options={{
          href: null, 
        }}
      />
      
      <Tabs.Screen
        name="preferences"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}