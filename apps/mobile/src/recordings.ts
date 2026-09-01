import { Directory, File, Paths } from "expo-file-system";

import type { LocalRecording, TranscriptionStatus } from "./types";

export const MAX_RECORDING_DURATION_SECONDS = 60 * 60;

interface StoredRecordingMetadata {
  id: string;
  groupId: string;
  groupName: string;
  createdAt: string;
  durationMs: number;
  audioFileName: string;
  transcriptFileName: string | null;
  transcriptionStatus: TranscriptionStatus;
}

const recordingsDirectory = new Directory(Paths.document, "MONJU", "recordings");

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function recordingFileName(createdAt: Date): string {
  return `${createdAt.getFullYear()}-${pad(createdAt.getMonth() + 1)}-${pad(
    createdAt.getDate(),
  )}_${pad(createdAt.getHours())}${pad(createdAt.getMinutes())}_MONJU.m4a`;
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

function ensureRecordingsDirectory(): void {
  recordingsDirectory.create({ idempotent: true, intermediates: true });
}

function recordingDirectory(id: string): Directory {
  return new Directory(recordingsDirectory, id);
}

function metadataFile(directory: Directory): File {
  return new File(directory, "metadata.json");
}

function hydrate(
  directory: Directory,
  metadata: StoredRecordingMetadata,
): LocalRecording {
  const transcript = metadata.transcriptFileName
    ? new File(directory, metadata.transcriptFileName)
    : null;
  return {
    ...metadata,
    audioUri: new File(directory, metadata.audioFileName).uri,
    transcript: transcript?.exists ? transcript.textSync() : null,
  };
}

function readMetadata(directory: Directory): StoredRecordingMetadata {
  return JSON.parse(metadataFile(directory).textSync()) as StoredRecordingMetadata;
}

function writeMetadata(
  directory: Directory,
  metadata: StoredRecordingMetadata,
): void {
  metadataFile(directory).write(JSON.stringify(metadata, null, 2));
}

export async function saveLocalRecording(
  sourceUri: string,
  input: {
    groupId: string;
    groupName: string;
    durationMs: number;
  },
): Promise<LocalRecording> {
  ensureRecordingsDirectory();
  const createdAt = new Date();
  const id = `${createdAt.getTime()}`;
  const directory = recordingDirectory(id);
  directory.create({ intermediates: true });

  try {
    const audioFileName = recordingFileName(createdAt);
    const source = new File(sourceUri);
    const destination = new File(directory, audioFileName);
    await source.move(destination);

    const metadata: StoredRecordingMetadata = {
      id,
      groupId: input.groupId,
      groupName: input.groupName,
      createdAt: createdAt.toISOString(),
      durationMs: input.durationMs,
      audioFileName,
      transcriptFileName: null,
      transcriptionStatus: "PENDING",
    };
    writeMetadata(directory, metadata);
    return hydrate(directory, metadata);
  } catch (error) {
    if (directory.exists) directory.delete();
    throw error;
  }
}

export function listLocalRecordings(): LocalRecording[] {
  ensureRecordingsDirectory();
  return recordingsDirectory
    .list()
    .filter((entry): entry is Directory => entry instanceof Directory)
    .flatMap((directory) => {
      try {
        return [hydrate(directory, readMetadata(directory))];
      } catch {
        return [];
      }
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getLocalRecording(id: string): LocalRecording | null {
  const directory = recordingDirectory(id);
  if (!directory.exists) return null;
  try {
    return hydrate(directory, readMetadata(directory));
  } catch {
    return null;
  }
}

export function saveTranscript(id: string, transcript: string): LocalRecording {
  const directory = recordingDirectory(id);
  const metadata = readMetadata(directory);
  const transcriptFileName = `${metadata.audioFileName.replace(/\.m4a$/i, "")}.txt`;
  new File(directory, transcriptFileName).write(transcript);
  const next: StoredRecordingMetadata = {
    ...metadata,
    transcriptFileName,
    transcriptionStatus: "COMPLETED",
  };
  writeMetadata(directory, next);
  return hydrate(directory, next);
}

export function markTranscriptionFailed(id: string): void {
  const directory = recordingDirectory(id);
  const metadata = readMetadata(directory);
  writeMetadata(directory, { ...metadata, transcriptionStatus: "FAILED" });
}

export function deleteLocalRecording(id: string): void {
  const directory = recordingDirectory(id);
  if (directory.exists) directory.delete();
}
