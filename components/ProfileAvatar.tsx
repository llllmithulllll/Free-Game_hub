import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { StyleProp, View, ViewStyle } from "react-native";

export default function ProfileAvatar({
  uri,
  size = 48,
  iconColor = "#111111",
  backgroundColor = "#f5c518",
  style,
}: {
  uri?: string | null;
  size?: number;
  iconColor?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{
      width: size,
      height: size,
      borderRadius: Math.round(size * 0.28),
      overflow: "hidden",
      backgroundColor,
      alignItems: "center",
      justifyContent: "center",
    }, style]}>
      {uri ? (
        <Image source={{ uri }} contentFit="cover" cachePolicy="memory" transition={120} style={{ width: "100%", height: "100%" }} />
      ) : (
        <Ionicons name="person" size={Math.round(size * 0.52)} color={iconColor} />
      )}
    </View>
  );
}
