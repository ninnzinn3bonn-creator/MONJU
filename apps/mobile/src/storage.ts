import * as SecureStore from "expo-secure-store";

import type { Precision, User } from "./types";

export const SESSION_TOKEN_KEY = "monju.session-token";
const SESSION_USER_KEY = "monju.session-user";
export const LOCATION_ENABLED_KEY = "monju.location-enabled";
export const LOCATION_PRECISION_KEY = "monju.location-precision";

export async function saveSession(token: string, user: User): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(SESSION_TOKEN_KEY, token, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    }),
    SecureStore.setItemAsync(SESSION_USER_KEY, JSON.stringify(user), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    }),
  ]);
}

export async function loadStoredSession(): Promise<{
  token: string;
  user: User | null;
} | null> {
  const [token, rawUser] = await Promise.all([
    SecureStore.getItemAsync(SESSION_TOKEN_KEY),
    SecureStore.getItemAsync(SESSION_USER_KEY),
  ]);
  if (!token) return null;

  let user: User | null = null;
  try {
    user = rawUser ? (JSON.parse(rawUser) as User) : null;
  } catch {
    user = null;
  }
  return { token, user };
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SESSION_TOKEN_KEY),
    SecureStore.deleteItemAsync(SESSION_USER_KEY),
  ]);
}

export async function setStoredPrecision(precision: Precision): Promise<void> {
  await SecureStore.setItemAsync(LOCATION_PRECISION_KEY, precision);
}

export async function getStoredPrecision(): Promise<Precision> {
  const value = await SecureStore.getItemAsync(LOCATION_PRECISION_KEY);
  return value === "MEDIUM" || value === "HIGH" ? value : "LOW";
}
