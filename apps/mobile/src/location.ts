import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { uploadLocation } from "./api";
import {
  getStoredPrecision,
  LOCATION_ENABLED_KEY,
  SESSION_TOKEN_KEY,
  setStoredPrecision,
} from "./storage";
import type { Precision } from "./types";

export const LOCATION_TASK_NAME = "monju-background-location";

interface LocationTaskData {
  locations?: Location.LocationObject[];
}

const androidForegroundService: Location.LocationTaskServiceOptions = {
  notificationTitle: "MONJUで位置共有中",
  notificationBody: "近くのメンバーとの集合を判定しています。",
  notificationColor: "#E85D3F",
  killServiceOnDestroy: false,
};

function platformTrackingOptions(
  showIosIndicator: boolean,
): Partial<Location.LocationTaskOptions> {
  if (Platform.OS === "android") {
    return { foregroundService: androidForegroundService };
  }
  return {
    activityType: Location.ActivityType.Other,
    pausesUpdatesAutomatically: !showIosIndicator,
    showsBackgroundLocationIndicator: showIosIndicator,
  };
}

function trackingOptions(precision: Precision): Location.LocationTaskOptions {
  if (precision === "HIGH") {
    return {
      accuracy: Location.Accuracy.Highest,
      distanceInterval: 5,
      deferredUpdatesDistance: 10,
      deferredUpdatesInterval: 10_000,
      ...platformTrackingOptions(true),
    };
  }
  if (precision === "MEDIUM") {
    return {
      accuracy: Location.Accuracy.High,
      distanceInterval: 25,
      deferredUpdatesDistance: 50,
      deferredUpdatesInterval: 60_000,
      ...platformTrackingOptions(true),
    };
  }
  return {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 100,
    deferredUpdatesDistance: 200,
    deferredUpdatesInterval: 180_000,
    ...platformTrackingOptions(false),
  };
}

async function applyTrackingPrecision(precision: Precision): Promise<void> {
  await Location.startLocationUpdatesAsync(
    LOCATION_TASK_NAME,
    trackingOptions(precision),
  );
}

if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask<LocationTaskData>(
    LOCATION_TASK_NAME,
    async ({ data, error }) => {
      if (error) {
        console.warn("MONJU location task failed", error.message);
        return;
      }

      const enabled = await SecureStore.getItemAsync(LOCATION_ENABLED_KEY);
      if (enabled !== "true") return;
      const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
      const latest = data.locations?.at(-1);
      if (!token || !latest) return;

      try {
        const result = await uploadLocation(
          {
            latitude: latest.coords.latitude,
            longitude: latest.coords.longitude,
            accuracyM: Math.max(latest.coords.accuracy ?? 100_000, 0),
            capturedAt: new Date(latest.timestamp).toISOString(),
          },
          token,
        );
        const previous = await getStoredPrecision();
        if (previous !== result.suggestedPrecision) {
          await setStoredPrecision(result.suggestedPrecision);
          await applyTrackingPrecision(result.suggestedPrecision);
        }
      } catch (taskError) {
        console.warn(
          "MONJU location upload failed",
          taskError instanceof Error ? taskError.message : taskError,
        );
      }
    },
  );
}

export async function isLocationSharingEnabled(): Promise<boolean> {
  const [flag, registered] = await Promise.all([
    SecureStore.getItemAsync(LOCATION_ENABLED_KEY),
    Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME),
  ]);
  return flag === "true" && registered;
}

export async function enableLocationSharing(): Promise<Precision> {
  let foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted) {
    foreground = await Location.requestForegroundPermissionsAsync();
  }
  if (!foreground.granted) {
    throw new Error("位置情報の使用中アクセスが必要です。");
  }

  let background = await Location.getBackgroundPermissionsAsync();
  if (!background.granted) {
    background = await Location.requestBackgroundPermissionsAsync();
  }
  if (!background.granted) {
    throw new Error(
      Platform.OS === "android"
        ? "アプリを閉じている間も集合を判定するには、設定画面で位置情報を「常に許可」にしてください。"
        : "アプリを閉じている間も集合を判定するには、位置情報を「常に」に設定してください。",
    );
  }

  const precision = await getStoredPrecision();
  await applyTrackingPrecision(precision);
  await SecureStore.setItemAsync(LOCATION_ENABLED_KEY, "true", {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });

  // Do not wait for the first background callback before the user sees a result.
  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  if (token) {
    const result = await uploadLocation(
      {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        accuracyM: Math.max(current.coords.accuracy ?? 100_000, 0),
        capturedAt: new Date(current.timestamp).toISOString(),
      },
      token,
    );
    await setStoredPrecision(result.suggestedPrecision);
    if (result.suggestedPrecision !== precision) {
      await applyTrackingPrecision(result.suggestedPrecision);
    }
    return result.suggestedPrecision;
  }
  return precision;
}

export async function disableLocationSharing(): Promise<void> {
  await SecureStore.setItemAsync(LOCATION_ENABLED_KEY, "false");
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}

export async function reconcileLocationTracking(): Promise<Precision> {
  const [enabled, precision] = await Promise.all([
    SecureStore.getItemAsync(LOCATION_ENABLED_KEY),
    getStoredPrecision(),
  ]);
  if (enabled === "true") await applyTrackingPrecision(precision);
  return precision;
}
