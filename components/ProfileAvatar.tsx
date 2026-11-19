import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { StyleProp, View, ViewStyle } from "react-native";
import { resolveProfileGif } from "@/lib/gif-avatars";
import { useEffect, useState } from "react";

export default function ProfileAvatar({
  uri,
  gifId,
  size = 48,
  iconColor = "#111111",
  backgroundColor = "#f5c518",
  style,
}: {
  uri?: string | null;
  gifId?: string | null;
  size?: number;
  iconColor?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [displayUri, setDisplayUri] = useState(uri || "");
  useEffect(() => {
    let active = true;
    setDisplayUri(uri || "");
    if (gifId) {
      void resolveProfileGif(gifId).then((gif) => {
        if (active && gif?.previewUrl) setDisplayUri(gif.previewUrl);
      }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [gifId, uri]);

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
      {displayUri ? (
        <Image source={{ uri: displayUri }} contentFit="cover" cachePolicy="memory" transition={120} style={{ width: "100%", height: "100%" }} />
      ) : (
        <Ionicons name="person" size={Math.round(size * 0.52)} color={iconColor} />
      )}
    </View>
  );
}
