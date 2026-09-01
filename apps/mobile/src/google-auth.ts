import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

import { authenticateWithGoogle } from "./api";
import { config, hasGoogleConfiguration } from "./config";
import { saveSession } from "./storage";
import type { Session } from "./types";

let configured = false;

function configureGoogle(): void {
  if (configured) return;
  if (!hasGoogleConfiguration()) {
    throw new Error(
      "Googleログイン設定がありません。.envのクライアントIDを設定してください。",
    );
  }
  GoogleSignin.configure({
    webClientId: config.googleWebClientId,
    ...(Platform.OS === "ios" && config.googleIosClientId
      ? { iosClientId: config.googleIosClientId }
      : {}),
  });
  configured = true;
}

export async function signInWithGoogle(): Promise<Session | null> {
  configureGoogle();
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  if (!response.data.idToken) {
    throw new Error(
      "Google IDトークンを取得できませんでした。WebクライアントIDを確認してください。",
    );
  }
  const session = await authenticateWithGoogle(response.data.idToken);
  await saveSession(session.sessionToken, session.user);
  return session;
}

export async function signOutFromGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // The local MONJU session can still be cleared if Google has no active user.
  }
}
