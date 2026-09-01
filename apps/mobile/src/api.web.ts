import type {
  GatheringSnapshot,
  GroupDetail,
  GroupMember,
  GroupSummary,
  Invite,
  Precision,
  Session,
  User,
} from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const now = "2026-08-30T09:00:00.000Z";
const currentUser: User = {
  id: "user-me",
  displayName: "山田 太郎",
  profileImageUrl: null,
  createdAt: now,
  updatedAt: now,
};

const members: Record<string, GroupMember> = {
  me: {
    id: "user-me",
    displayName: "山田 太郎",
    profileImageUrl: null,
    joinedAt: "2026-08-10T09:00:00.000Z",
    isLocationSharing: true,
    isLeader: true,
  },
  suzuki: {
    id: "user-suzuki",
    displayName: "鈴木 花子",
    profileImageUrl: null,
    joinedAt: "2026-08-11T09:00:00.000Z",
    isLocationSharing: true,
    isLeader: false,
  },
  sato: {
    id: "user-sato",
    displayName: "佐藤 健",
    profileImageUrl: null,
    joinedAt: "2026-08-12T09:00:00.000Z",
    isLocationSharing: true,
    isLeader: false,
  },
  takahashi: {
    id: "user-takahashi",
    displayName: "高橋 美咲",
    profileImageUrl: null,
    joinedAt: "2026-08-20T09:00:00.000Z",
    isLocationSharing: false,
    isLeader: false,
  },
};

let groups: GroupDetail[] = [
  {
    id: "group-dev",
    name: "MONJU開発チーム",
    leaderUserId: "user-me",
    requiredMemberCount: 3,
    gatheringRadiusM: 50,
    gatheringDurationSec: 60,
    candidateGraceSec: 30,
    leavingDurationSec: 600,
    state: "GATHERED",
    memberCount: 3,
    members: [members.me!, members.suzuki!, members.sato!],
  },
  {
    id: "group-reading",
    name: "週末読書会",
    leaderUserId: "user-me",
    requiredMemberCount: 3,
    gatheringRadiusM: 80,
    gatheringDurationSec: 120,
    candidateGraceSec: 30,
    leavingDurationSec: 900,
    state: "CANDIDATE",
    memberCount: 2,
    members: [members.me!, members.takahashi!],
  },
];

const pause = () => new Promise((resolve) => setTimeout(resolve, 160));
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const summary = (group: GroupDetail): GroupSummary => {
  const { members: _members, ...rest } = group;
  return rest;
};

async function readGroups(): Promise<GroupSummary[]> {
  await pause();
  return clone(groups.map(summary));
}

export const listGroups = Object.assign(readGroups, {
  sync: (): GroupSummary[] => clone(groups.map(summary)),
});

export async function authenticateWithGoogle(): Promise<Session> {
  await pause();
  return { sessionToken: "monju-local-preview", user: clone(currentUser) };
}

export async function getMe(): Promise<User> {
  await pause();
  return clone(currentUser);
}

export async function deleteMe(): Promise<void> {
  await pause();
}

export async function getGroup(groupId: string): Promise<GroupDetail> {
  await pause();
  const group = groups.find(({ id }) => id === groupId);
  if (!group) throw new ApiError(404, "NOT_FOUND", "グループが見つかりません。");
  return clone(group);
}

export async function createGroup(name: string, requiredMemberCount: number): Promise<string> {
  await pause();
  const id = `group-${Date.now()}`;
  groups = [
    ...groups,
    {
      id,
      name,
      leaderUserId: currentUser.id,
      requiredMemberCount,
      gatheringRadiusM: 50,
      gatheringDurationSec: 60,
      candidateGraceSec: 30,
      leavingDurationSec: 600,
      state: "NOT_GATHERED",
      memberCount: 1,
      members: [members.me!],
    },
  ];
  return id;
}

export async function updateGroup(
  groupId: string,
  input: {
    name: string;
    requiredMemberCount: number;
    gatheringRadiusM: number;
    gatheringDurationSec: number;
    leavingDurationSec: number;
  },
): Promise<void> {
  await pause();
  groups = groups.map((group) => group.id === groupId ? { ...group, ...input } : group);
}

export async function deleteGroup(groupId: string): Promise<void> {
  await pause();
  groups = groups.filter(({ id }) => id !== groupId);
}

export const leaveGroup = deleteGroup;

export async function removeMember(groupId: string, userId: string): Promise<void> {
  await pause();
  groups = groups.map((group) => {
    if (group.id !== groupId) return group;
    const nextMembers = group.members.filter(({ id }) => id !== userId);
    return { ...group, members: nextMembers, memberCount: nextMembers.length };
  });
}

export async function createInvite(groupId: string): Promise<Invite> {
  await pause();
  return {
    id: `invite-${groupId}`,
    token: "MONJU_LOCAL_PREVIEW_INVITE_12345678",
    deepLink: "monju://invite/MONJU_LOCAL_PREVIEW_INVITE_12345678",
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  };
}

export async function joinInvite(): Promise<string> {
  await pause();
  const existing = groups.find(({ id }) => id === "group-design");
  if (!existing) {
    groups = [
      ...groups,
      {
        id: "group-design",
        name: "デザインレビュー",
        leaderUserId: "user-suzuki",
        requiredMemberCount: 2,
        gatheringRadiusM: 50,
        gatheringDurationSec: 60,
        candidateGraceSec: 30,
        leavingDurationSec: 600,
        state: "NOT_GATHERED",
        memberCount: 2,
        members: [
          { ...members.suzuki!, isLeader: true },
          { ...members.me!, isLeader: false },
        ],
      },
    ];
  }
  return "group-design";
}

export interface LocationUploadResponse {
  suggestedPrecision: Precision;
  groups: Array<{ groupId: string; state: string }>;
}

export async function uploadLocation(): Promise<LocationUploadResponse> {
  return { suggestedPrecision: "MEDIUM", groups: [] };
}

export async function registerDeviceToken(): Promise<void> {}

export async function getGathering(groupId: string): Promise<GatheringSnapshot> {
  await pause();
  const group = groups.find(({ id }) => id === groupId);
  return {
    state: group?.state ?? "NOT_GATHERED",
    candidateStartedAt: group?.state === "CANDIDATE" ? now : null,
    gatheredAt: group?.state === "GATHERED" ? now : null,
    leavingStartedAt: null,
    recorderUserId: null,
    recordingStartedAt: null,
    updatedAt: now,
  };
}

export async function claimRecording(): Promise<void> {
  await pause();
}
