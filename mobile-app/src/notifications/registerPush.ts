import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "../api/client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Call once after login (and again on app start if a token might have
// rotated). Requests OS permission, gets the Expo push token, and uploads
// it so the backend cron (reminderCron.ts) can target this device.
export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device, not a simulator.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.warn("Push notification permission denied.");
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: expoToken } = await Notifications.getExpoPushTokenAsync({ projectId });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#e08a55",
    });
  }

  const deviceId = Device.osInternalBuildId || Device.modelId || "unknown-device";
  await api.registerPushToken(expoToken, deviceId, Platform.OS as "ios" | "android");

  return expoToken;
}
