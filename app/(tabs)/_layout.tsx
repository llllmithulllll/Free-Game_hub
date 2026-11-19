import { Fontisto, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/lib/theme";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { withLayoutContext } from "expo-router";
import { Platform, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useEffect, type ReactNode } from "react";

const { Navigator } = createMaterialTopTabNavigator();
const SwipeTabs = withLayoutContext(Navigator);

function ActiveTabIcon({ focused, children }: { focused: boolean; children: ReactNode }) {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withSpring(focused ? -0.12 : 0, { damping: 14, stiffness: 190 });
  }, [focused, rotation]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}rad` }, { translateY: focused ? -1 : 0 }],
  }));
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export default function TabLayout() {
  const { colors, accentTheme } = useAppTheme();
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === "web" && width >= 768;
  return (
    <SwipeTabs
      tabBarPosition={isWideWeb ? "top" : "bottom"}
      screenOptions={{
        swipeEnabled: !isWideWeb,
        animationEnabled: !isWideWeb,
        lazy: true,
        lazyPreloadDistance: 1,
        sceneStyle: { backgroundColor: colors.background },
        tabBarShowIcon: !isWideWeb,
        tabBarScrollEnabled: isWideWeb,
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: isWideWeb ? 0 : 1,
          borderTopColor: colors.border,
          borderBottomWidth: isWideWeb ? 1 : 0,
          borderBottomColor: colors.border,
          height: isWideWeb ? 68 : 60,
          paddingBottom: isWideWeb ? 0 : 4,
          elevation: 0,
        },
        tabBarIndicatorStyle: { height: isWideWeb ? 3 : 0, backgroundColor: colors.accent },
        tabBarLabelStyle: {
          fontSize: isWideWeb ? 14 : 12,
          fontWeight: "700",
          textTransform: "none",
          marginTop: isWideWeb ? 0 : 0,
        },
        tabBarItemStyle: isWideWeb ? { height: 64, width: "auto", paddingHorizontal: 20 } : { height: 56 },
        tabBarContentContainerStyle: isWideWeb ? { width: "100%", maxWidth: 1480, alignSelf: "center" } : undefined,
      }}
    >
      <SwipeTabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarLabel: isWideWeb ? "Store" : "Home",
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <ActiveTabIcon focused={focused}>
            {accentTheme === "xbox" ? <Fontisto name="xbox" size={19} color={color} />
              : accentTheme === "playstation" ? <Fontisto name="playstation" size={21} color={color} />
                : accentTheme === "nintendo" ? <MaterialCommunityIcons name="nintendo-switch" size={22} color={color} />
                  : <Ionicons name="game-controller" size={20} color={color} />}
          </ActiveTabIcon>,
        }}
      />
      <SwipeTabs.Screen
        name="free_now"
        options={{
          title: "Giveaways",
          tabBarLabel: "Giveaways",
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <ActiveTabIcon focused={focused}><Ionicons name="gift" size={20} color={color} /></ActiveTabIcon>,
        }}
      />
      <SwipeTabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarLabel: "Friends",
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <ActiveTabIcon focused={focused}><Ionicons name="people" size={20} color={color} /></ActiveTabIcon>,
        }}
      />
      <SwipeTabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <ActiveTabIcon focused={focused}><Ionicons name="person" size={20} color={color} /></ActiveTabIcon>,
        }}
      />
    </SwipeTabs>
  );
}
