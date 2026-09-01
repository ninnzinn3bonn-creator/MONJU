import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";

export async function ensureMicrophonePermission(): Promise<boolean> {
  const current = await getRecordingPermissionsAsync();
  if (current.granted) return true;
  const requested = await requestRecordingPermissionsAsync();
  return requested.granted;
}
