import { AccentTheme, useAppTheme } from "@/lib/theme";
import { FontAwesome5, Fontisto, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useEffect } from "react";
import { View } from "react-native";

const DECORATIONS = [
  { top: "7%", left: "4%", size: 48, duration: 7600, phase: 0 },
  { top: "18%", right: "5%", size: 42, duration: 9400, phase: 1 },
  { top: "30%", left: "15%", size: 34, duration: 8200, phase: 2 },
  { top: "43%", right: "16%", size: 54, duration: 10200, phase: 3 },
  { top: "57%", left: "4%", size: 46, duration: 8800, phase: 4 },
  { top: "70%", right: "6%", size: 40, duration: 9800, phase: 5 },
  { top: "82%", left: "18%", size: 52, duration: 8600, phase: 6 },
  { top: "93%", right: "24%", size: 32, duration: 9200, phase: 7 },
] as const;

function FloatingLogo({ item, theme, color, reducedMotion }: { item: (typeof DECORATIONS)[number]; theme: AccentTheme; color: string; reducedMotion: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) {
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(withTiming(1, { duration: item.duration, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [item.duration, progress, reducedMotion]);
  const animation = useAnimatedStyle(() => ({
    opacity: 0.065 + progress.value * 0.085,
    transform: [
      { translateY: progress.value * (item.phase % 2 === 0 ? -15 : 15) },
      { rotateZ: `${(progress.value - 0.5) * (item.phase % 2 === 0 ? 7 : -7)}deg` },
      { scale: 0.9 + progress.value * 0.18 },
    ],
  }));
  const glow = { textShadowColor: color, textShadowRadius: 15, textShadowOffset: { width: 0, height: 0 } };
  const genericIcons = theme === "neon" ? ["ghost", "gamepad-variant"] : ["gamepad-variant", "dice-d20"];
  const brand = theme === "xbox" ? "xbox" : theme === "playstation" ? "playstation" : theme === "nintendo" ? "nintendo-switch" : theme === "rgb" ? (["xbox", "playstation", "nintendo-switch", "xbox"] as const)[item.phase % 4] : null;
  const generic = genericIcons[item.phase % genericIcons.length];
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ position: "absolute", top: item.top, left: "left" in item ? item.left : undefined, right: "right" in item ? item.right : undefined }, animation]}>
      {brand === "xbox" ? <Fontisto name="xbox" size={item.size} color={color} style={glow} />
        : brand === "playstation" ? <Fontisto name="playstation" size={item.size} color={color} style={glow} />
          : brand === "nintendo-switch" ? <MaterialCommunityIcons name="nintendo-switch" size={item.size + 8} color={color} style={glow} />
            : generic === "ghost" ? <FontAwesome5 name="ghost" size={item.size} color={color} style={glow} />
              : <MaterialCommunityIcons name={generic as "gamepad-variant" | "dice-d20"} size={item.size} color={color} style={glow} />}
    </Animated.View>
  );
}

/** Low-contrast, slow-moving game-platform marks for the open background areas. */
export default function GamingBackdrop() {
  const { colors, accentTheme } = useAppTheme();
  const reducedMotion = useReducedMotion();
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
      {DECORATIONS.map((item, index) => <FloatingLogo key={`${accentTheme}-${index}`} item={item} theme={accentTheme} color={colors.accentText} reducedMotion={!!reducedMotion} />)}
    </View>
  );
}

