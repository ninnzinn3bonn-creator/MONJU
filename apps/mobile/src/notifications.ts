import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { registerDeviceToken } from "./api";
import { config } from "./config";

export const GATHERING_CATEGORY = "gathering";
export const START_RECORDING_ACTION = "START_RECORDING";
export const DEFAULT_NOTIFICATION_CHANNEL = "default";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function configureNotifications(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(
      DEFAULT_NOTIFICATION_CHANNEL,
      {
        name: "MONJUのお知らせ",
        description: "集合判定と録音開始をお知らせします。",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
        lightColor: "#E85D3F",
      },
    );
  }

  await Notifications.setNotificationCategoryAsync(GATHERING_CATEGORY, [
    {
      identifier: START_RECORDING_ACTION,
      buttonTitle: "録音開始",
      options: { opensAppToForeground: true },
    },
  ]);
}

export async function registerPushNotifications(): Promise<boolean> {
  if (!Device.isDevice) return false;

  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted
    ? existing
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;

  const projectId =
    config.easProjectId ||
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
      ?.projectId;
  if (!projectId) {
    console.warn("EXPO_PUBLIC_EAS_PROJECT_ID is not configured");
    return false;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerDeviceToken(token.data);
  return true;
}

export function getGroupIdFromNotification(
  response: Notifications.NotificationResponse,
): string | null {
  const value = response.notification.request.content.data?.groupId;
  return typeof value === "string" ? value : null;
}
