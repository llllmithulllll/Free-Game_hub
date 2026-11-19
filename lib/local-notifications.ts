import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type LocalNotificationSettings = {
  friendRequests: boolean;
  giveawayAlerts: boolean;
  giveawayPlatforms: string[];
  giveawayTypes: string[];
};

const SETTINGS_KEY = "@gamehub_notification_settings_v1";

export const DEFAULT_NOTIFICATION_SETTINGS: LocalNotificationSettings = {
  friendRequests: false,
  giveawayAlerts: false,
  giveawayPlatforms: ["all"],
  giveawayTypes: ["all"],
};

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function loadNotificationSettings(): Promise<LocalNotificationSettings> {
  try {
    const saved = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!saved) return DEFAULT_NOTIFICATION_SETTINGS;
    const parsed = JSON.parse(saved);
    // Migrate the previous single-platform setting to the new multi-select format.
    const giveawayPlatforms = Array.isArray(parsed.giveawayPlatforms)
      ? parsed.giveawayPlatforms.filter((value: unknown) => typeof value === "string")
      : typeof parsed.giveawayPlatform === "string" ? [parsed.giveawayPlatform] : ["all"];
    const giveawayTypes = Array.isArray(parsed.giveawayTypes)
      ? parsed.giveawayTypes.filter((value: unknown) => typeof value === "string")
      : ["all"];
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...parsed, giveawayPlatforms, giveawayTypes };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export async function saveNotificationSettings(settings: LocalNotificationSettings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function requestLocalNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "GameHub alerts",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted
      ? current
      : await Notifications.requestPermissionsAsync();
    return permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch (error) {
    console.error("Notification permission request failed:", error);
    return false;
  }
}

export async function showLocalNotification(title: string, body: string, data?: Record<string, string>) {
  if (Platform.OS === "web") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      trigger: null,
    });
  } catch (error) {
    console.error("Could not show local notification:", error);
  }
}
