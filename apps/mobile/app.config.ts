import type { ConfigContext, ExpoConfig } from "expo/config";

const googleIosUrlScheme =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ??
  "com.googleusercontent.apps.REPLACE_WITH_IOS_CLIENT_ID";
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON?.trim();

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "MONJU",
  slug: "monju",
  platforms: ["ios", "android", "web"],
  scheme: "monju",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  web: {
    bundler: "metro",
    favicon: "./assets/favicon.png",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier:
      process.env.EXPO_PUBLIC_IOS_BUNDLE_ID ?? "jp.monju.app",
    deploymentTarget: "17.0",
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    package:
      process.env.EXPO_PUBLIC_ANDROID_PACKAGE ?? "jp.monju.app",
    versionCode: 1,
    allowBackup: false,
    adaptiveIcon: {
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
  plugins: [
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "MONJUは、近くにいるグループメンバーとの集合を判定するために位置情報を使用します。",
        locationAlwaysAndWhenInUsePermission:
          "MONJUは、アプリを閉じている間も集合を判定するために位置情報を使用します。",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission:
          "MONJUは、グループ招待のQRコードを読み取るためにカメラを使用します。",
        recordAudioAndroid: false,
        barcodeScannerEnabled: true,
      },
    ],
    [
      "expo-notifications",
      {
        color: "#E85D3F",
        defaultChannel: "default",
      },
    ],
    "expo-secure-store",
    [
      "expo-audio",
      {
        microphonePermission:
          "MONJUは、集まった仲間との会話を録音するためにマイクを使用します。",
        enableBackgroundRecording: true,
      },
    ],
    [
      "expo-speech-recognition",
      {
        microphonePermission:
          "MONJUは、集まった仲間との会話を録音するためにマイクを使用します。",
        speechRecognitionPermission:
          "MONJUは、録音した会話を文字に起こすために音声認識を使用します。",
      },
    ],
    [
      "@react-native-google-signin/google-signin",
      { iosUrlScheme: googleIosUrlScheme },
    ],
  ],
  extra: {
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "",
    },
  },
});
