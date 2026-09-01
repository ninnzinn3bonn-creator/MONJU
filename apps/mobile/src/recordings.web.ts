import type { LocalRecording, TranscriptionStatus } from "./types";

export const MAX_RECORDING_DURATION_SECONDS = 60 * 60;

const seed: LocalRecording = {
  id: "recording-seed",
  groupId: "group-dev",
  groupName: "MONJU開発チーム",
  createdAt: "2026-08-29T10:32:00.000Z",
  durationMs: 312_000,
  audioFileName: "2026-08-29_1932_MONJU.m4a",
  transcriptFileName: "2026-08-29_1932_MONJU.txt",
  transcriptionStatus: "COMPLETED",
  transcript:
    "今日の確認事項は、Android版の実機テストと通知の動作確認です。\n次回までに録音から文字起こしまでの導線を整えます。",
  audioUri: "monju-preview://recording-seed",
};

let recordings: LocalRecording[] = [seed];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function recordingFileName(createdAt: Date): string {
  return `${createdAt.getFullYear()}-${pad(createdAt.getMonth() + 1)}-${pad(createdAt.getDate())}_${pad(createdAt.getHours())}${pad(createdAt.getMinutes())}_MONJU.m4a`;
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

export async function saveLocalRecording(
  _sourceUri: string,
  input: { groupId: string; groupName: string; durationMs: number },
): Promise<LocalRecording> {
  const createdAt = new Date();
  const audioFileName = recordingFileName(createdAt);
  const recording: LocalRecording = {
    id: String(createdAt.getTime()),
    ...input,
    durationMs: Math.max(input.durationMs, 4_000),
    createdAt: createdAt.toISOString(),
    audioFileName,
    transcriptFileName: null,
    transcriptionStatus: "PENDING",
    transcript: null,
    audioUri: `monju-preview://${audioFileName}`,
  };
  recordings = [recording, ...recordings];
  return recording;
}

export function listLocalRecordings(): LocalRecording[] {
  return recordings.map((recording) => ({ ...recording }));
}

export function getLocalRecording(id: string): LocalRecording | null {
  const recording = recordings.find((item) => item.id === id);
  return recording ? { ...recording } : null;
}

export function saveTranscript(id: string, transcript: string): LocalRecording {
  const index = recordings.findIndex((recording) => recording.id === id);
  const recording = recordings[index];
  if (!recording) throw new Error("録音が見つかりません。");
  const next: LocalRecording = {
    ...recording,
    transcript,
    transcriptFileName: recording.audioFileName.replace(/\.m4a$/i, ".txt"),
    transcriptionStatus: "COMPLETED",
  };
  recordings[index] = next;
  return { ...next };
}

export function markTranscriptionFailed(id: string): void {
  setStatus(id, "FAILED");
}

function setStatus(id: string, status: TranscriptionStatus): void {
  recordings = recordings.map((recording) =>
    recording.id === id ? { ...recording, transcriptionStatus: status } : recording,
  );
}

export function deleteLocalRecording(id: string): void {
  recordings = recordings.filter((recording) => recording.id !== id);
}
