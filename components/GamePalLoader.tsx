import { useAppTheme } from "@/lib/theme";
import { Image as ExpoImage } from "expo-image";
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { Platform, Text, View } from "react-native";

const DARK_ANIMATION = require("@/assets/gamepal/animated-svg/gamepal-controller-animated-white-on-black.svg");
const LIGHT_ANIMATION = require("@/assets/gamepal/animated-svg/gamepal-controller-animated-black-on-white.svg");
const COLOR_ANIMATION = require("@/assets/gamepal/animated-svg/gamepal-controller-animated-color.svg");
const DARK_STATIC = require("@/assets/gamepal/animated-svg/gamepal-controller-static-dark.svg");
const LIGHT_STATIC = require("@/assets/gamepal/animated-svg/gamepal-controller-static-light.svg");
const COLOR_STATIC = require("@/assets/gamepal/animated-svg/gamepal-controller-static-color.svg");
const DARK_LEFT = require("@/assets/gamepal/animated-svg/gamepal-controller-left-dark.svg");
const LIGHT_LEFT = require("@/assets/gamepal/animated-svg/gamepal-controller-left-light.svg");
const COLOR_LEFT = require("@/assets/gamepal/animated-svg/gamepal-controller-left-color.svg");
const DARK_RIGHT = require("@/assets/gamepal/animated-svg/gamepal-controller-right-dark.svg");
const LIGHT_RIGHT = require("@/assets/gamepal/animated-svg/gamepal-controller-right-light.svg");
const COLOR_RIGHT = require("@/assets/gamepal/animated-svg/gamepal-controller-right-color.svg");

export default function GamePalLoader({ size = 150, label, fullScreen = true, variant = "theme" }: { size?: number; label?: string; fullScreen?: boolean; variant?: "theme" | "startup" }) {
  const { colors, resolvedMode } = useAppTheme();
  const leftRotation = useSharedValue(0);
  const rightRotation = useSharedValue(0);

  useEffect(() => {
    leftRotation.value = withRepeat(withTiming(360, { duration: 2200, reduceMotion: ReduceMotion.System }), -1, false);
    rightRotation.value = withRepeat(withTiming(-360, { duration: 2200, reduceMotion: ReduceMotion.System }), -1, false);
    return () => {
      cancelAnimation(leftRotation);
      cancelAnimation(rightRotation);
    };
  }, [leftRotation, rightRotation]);

  const artHeight = size * 0.92;
  const scale = size / 500;
  const leftPivotX = 130.5 * scale;
  const leftPivotY = 115 * scale;
  const rightPivotX = 374.5 * scale;
  const rightPivotY = 108 * scale;
  const leftStyle = useAnimatedStyle(() => ({
    transformOrigin: [leftPivotX, leftPivotY, 0],
    transform: [{ rotate: `${leftRotation.value}deg` }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    transformOrigin: [rightPivotX, rightPivotY, 0],
    transform: [{ rotate: `${rightRotation.value}deg` }],
  }));

  const dark = resolvedMode === "dark";
  const startup = variant === "startup";
  const animationSource = startup ? COLOR_ANIMATION : dark ? DARK_ANIMATION : LIGHT_ANIMATION;
  const staticSource = startup ? COLOR_STATIC : dark ? DARK_STATIC : LIGHT_STATIC;
  const leftSource = startup ? COLOR_LEFT : dark ? DARK_LEFT : LIGHT_LEFT;
  const rightSource = startup ? COLOR_RIGHT : dark ? DARK_RIGHT : LIGHT_RIGHT;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label || "Loading GamePal"}
      style={{ flex: fullScreen ? 1 : undefined, justifyContent: "center", alignItems: "center", backgroundColor: startup ? "#0B0F19" : colors.background, padding: fullScreen ? 24 : 8 }}
    >
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        {Platform.OS === "web" ? (
          <ExpoImage source={animationSource} contentFit="contain" autoplay style={{ width: size, height: artHeight }} />
        ) : (
          <View style={{ width: size, height: artHeight, position: "relative" }}>
            <ExpoImage source={staticSource} contentFit="contain" style={{ width: size, height: artHeight }} />
            <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: size, height: artHeight }, leftStyle]}>
              <ExpoImage source={leftSource} contentFit="contain" style={{ width: size, height: artHeight }} />
            </Animated.View>
            <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: size, height: artHeight }, rightStyle]}>
              <ExpoImage source={rightSource} contentFit="contain" style={{ width: size, height: artHeight }} />
            </Animated.View>
          </View>
        )}
      </View>
      {!!label && <Text style={{ color: startup ? "#F5F7FA" : colors.textSecondary, fontSize: 13, fontWeight: "600", marginTop: 14 }}>{label}</Text>}
    </View>
  );
}
