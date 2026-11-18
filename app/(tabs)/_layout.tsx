import { Ionicons } from "@expo/vector-icons";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { withLayoutContext } from "expo-router";

const { Navigator } = createMaterialTopTabNavigator();
const SwipeTabs = withLayoutContext(Navigator);

export default function TabLayout() {
  return (
    <SwipeTabs
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
        lazy: true,
        lazyPreloadDistance: 1,
        tabBarShowIcon: true,
        tabBarActiveTintColor: "#f5c518",
        tabBarInactiveTintColor: "#888",
        tabBarStyle: {
          backgroundColor: "#1e1e1e",
          borderTopWidth: 1,
          borderTopColor: "#333",
          height: 60,
          paddingBottom: 4,
        },
        tabBarIndicatorStyle: { height: 0 },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "bold",
          textTransform: "none",
          marginTop: 0,
        },
        tabBarItemStyle: { height: 56 },
      }}
    >
      <SwipeTabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarLabel: "Home",
          tabBarIcon: ({ color }) => <Ionicons name="game-controller" size={20} color={color} />,
        }}
      />
      <SwipeTabs.Screen
        name="free_now"
        options={{
          title: "Giveaways",
          tabBarLabel: "Giveaways",
          tabBarIcon: ({ color }) => <Ionicons name="gift" size={20} color={color} />,
        }}
      />
      <SwipeTabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarLabel: "Friends",
          tabBarIcon: ({ color }) => <Ionicons name="people" size={20} color={color} />,
        }}
      />
      <SwipeTabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarLabel: "Profile",
          tabBarIcon: ({ color }) => <Ionicons name="person" size={20} color={color} />,
        }}
      />
    </SwipeTabs>
  );
}
