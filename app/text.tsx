import { auth } from "@/lib/firebase";
import { Text, View } from "react-native";


export default function Test() {
  return (
    <View>
      <Text>Firebase loaded: {auth ? "YES" : "NO"}</Text>
    </View>
  );
}
