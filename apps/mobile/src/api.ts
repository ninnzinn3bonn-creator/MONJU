import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { config } from "./config";
import { SESSION_TOKEN_KEY } from "./storage";
import type {
  GatheringSnapshot,
  GroupDetail,
  GroupSummary,
  Invite,
  Precision,
  Session,
  User,
} from "./types";

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

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

interface ApiRequestOptions extends RequestInit {
  token?: string | null;
}

async function request<T>(
  path: string,
  { token, ...init }: ApiRequestOptions = {},
): Promise<T> {
  const sessionToken =
    token === undefined
      ? await SecureStore.getItemAsync(SESSION_TOKEN_KEY)
      : token;
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      let body: ApiErrorBody = {};
      try {
        body = (await response.json()) as ApiErrorBody;
      } catch {
        // The status still gives callers a useful failure mode.
      }
      throw new ApiError(
        response.status,
        body.error?.code ?? "REQUEST_FAILED",
        body.error?.message ?? "通信に失敗しました。",
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(0, "TIMEOUT", "サーバーへの接続がタイムアウトしました。");
    }
    throw new ApiError(0, "NETWORK_ERROR", "サーバーに接続できませんでした。");
  } finally {
    clearTimeout(timeout);
  }
}

export async function authenticateWithGoogle(idToken: string): Promise<Session> {
  return request<Session>("/auth/google", {
    method: "POST",
    token: null,
    body: JSON.stringify({ idToken }),
  });
}

export async function getMe(token?: string): Promise<User> {
  const response = await request<{ user: User }>("/me", { token });
  return response.user;
}

export async function deleteMe(): Promise<void> {
  await request("/me", { method: "DELETE" });
}

export async function listGroups(): Promise<GroupSummary[]> {
  const response = await request<{ groups: GroupSummary[] }>("/groups");
  return response.groups;
}

export async function getGroup(groupId: string): Promise<GroupDetail> {
  const response = await request<{ group: GroupDetail }>(`/groups/${groupId}`);
  return response.group;
}

export async function createGroup(
  name: string,
  requiredMemberCount: number,
): Promise<string> {
  const response = await request<{ groupId: string }>("/groups", {
    method: "POST",
    body: JSON.stringify({ name, requiredMemberCount }),
  });
  return response.groupId;
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
  await request(`/groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteGroup(groupId: string): Promise<void> {
  await request(`/groups/${groupId}`, { method: "DELETE" });
}

export async function leaveGroup(groupId: string): Promise<void> {
  await request(`/groups/${groupId}/leave`, { method: "POST" });
}

export async function removeMember(
  groupId: string,
  userId: string,
): Promise<void> {
  await request(`/groups/${groupId}/members/${userId}`, { method: "DELETE" });
}

export async function createInvite(groupId: string): Promise<Invite> {
  const response = await request<{ invite: Invite }>(
    `/groups/${groupId}/invites`,
    { method: "POST" },
  );
  return response.invite;
}

export async function joinInvite(token: string): Promise<string> {
  const response = await request<{ groupId: string }>(
    `/invites/${encodeURIComponent(token)}/join`,
    { method: "POST" },
  );
  return response.groupId;
}

export interface LocationUploadResponse {
  suggestedPrecision: Precision;
  groups: Array<{ groupId: string; state: string }>;
}

export async function uploadLocation(
  input: {
    latitude: number;
    longitude: number;
    accuracyM: number;
    capturedAt: string;
  },
  token?: string,
): Promise<LocationUploadResponse> {
  return request<LocationUploadResponse>("/me/location", {
    method: "PUT",
    token,
    body: JSON.stringify(input),
  });
}

export async function registerDeviceToken(
  deviceToken: string,
): Promise<void> {
  await request("/me/device-token", {
    method: "PUT",
    body: JSON.stringify({
      deviceToken,
      platform: Platform.OS === "android" ? "android" : "ios",
    }),
  });
}

export async function getGathering(
  groupId: string,
): Promise<GatheringSnapshot> {
  const response = await request<{ gathering: GatheringSnapshot }>(
    `/groups/${groupId}/gathering`,
  );
  return response.gathering;
}

export async function claimRecording(groupId: string): Promise<void> {
  await request(`/groups/${groupId}/recording/claim`, { method: "POST" });
}
