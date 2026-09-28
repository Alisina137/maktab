import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { api } from "./api";

declare const process: { env: { EXPO_PUBLIC_EAS_PROJECT_ID?: string } };

let registeredToken: string | null = null;
let registeredPlatform: "ANDROID" | "IOS" | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
});

function projectId() {
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    null
  );
}

export async function registerPushForSession(accessToken: string) {
  try {
    if (!Device.isDevice) return null;
    const id = projectId();
    if (!id) return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "MaktabLink",
        importance: Notifications.AndroidImportance.DEFAULT
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return null;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    const platform = Platform.OS === "ios" ? "IOS" : "ANDROID";
    await api.registerPushDevice(accessToken, token, platform);
    registeredToken = token;
    registeredPlatform = platform;
    return token;
  } catch {
    return null;
  }
}

export async function deactivatePushForSession(accessToken: string) {
  if (!registeredToken || !registeredPlatform) return;
  try {
    await api.deactivatePushDevice(accessToken, registeredToken, registeredPlatform);
  } catch {
    // Logout must never depend on notification connectivity.
  } finally {
    registeredToken = null;
    registeredPlatform = null;
  }
}
