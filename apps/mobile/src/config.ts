import { Platform } from "react-native";

export const config = {
  apiBaseUrl:
    process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
    "http://127.0.0.1:8787",
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "",
} as const;

export function hasGoogleConfiguration(): boolean {
  return Boolean(
    config.googleWebClientId &&
      (Platform.OS !== "ios" || config.googleIosClientId),
  );
}
