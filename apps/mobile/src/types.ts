export type GatheringState =
  | "NOT_GATHERED"
  | "CANDIDATE"
  | "GATHERED"
  | "LEAVING";

export type Precision = "LOW" | "MEDIUM" | "HIGH";

export interface User {
  id: string;
  displayName: string;
  profileImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  sessionToken: string;
  user: User;
}

export interface GroupSummary {
  id: string;
  name: string;
  leaderUserId: string;
  requiredMemberCount: number;
  gatheringRadiusM: number;
  gatheringDurationSec: number;
  candidateGraceSec: number;
  leavingDurationSec: number;
  state: GatheringState;
  memberCount: number;
}

export interface GroupMember {
  id: string;
  displayName: string;
  profileImageUrl: string | null;
  joinedAt: string;
  isLocationSharing: boolean;
  isLeader: boolean;
}

export interface GroupDetail extends GroupSummary {
  members: GroupMember[];
}

export interface Invite {
  id: string;
  token: string;
  deepLink: string;
  expiresAt: string;
}

export interface GatheringSnapshot {
  state: GatheringState;
  candidateStartedAt: string | null;
  gatheredAt: string | null;
  leavingStartedAt: string | null;
  recorderUserId: string | null;
  recordingStartedAt: string | null;
  updatedAt: string;
}

export type TranscriptionStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface LocalRecording {
  id: string;
  groupId: string;
  groupName: string;
  createdAt: string;
  durationMs: number;
  audioFileName: string;
  transcriptFileName: string | null;
  transcriptionStatus: TranscriptionStatus;
  transcript: string | null;
  audioUri: string;
}

export type Screen =
  | { name: "home" }
  | { name: "createGroup" }
  | { name: "scanInvite" }
  | { name: "group"; groupId: string }
  | { name: "editGroup"; group: GroupDetail }
  | { name: "recording"; groupId: string; groupName: string }
  | { name: "transcribing"; recordingId: string }
  | { name: "recordings" }
  | { name: "recordingDetail"; recordingId: string };
