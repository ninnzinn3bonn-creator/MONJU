import type { QueryResultRow } from "pg";

import {
  createSessionToken,
  verifyGoogleIdToken,
} from "./auth";
import type { DatabaseClient } from "./db";
import { withTransaction } from "./db";
import { ApiError } from "./errors";
import { evaluateUserGroups } from "./gathering-service";
import {
  empty,
  json,
  matchPath,
  readJson,
  requiredParam,
} from "./http";
import { sendGatheringPush, sendRecordingStartedPush } from "./push";
import {
  createGroupSchema,
  deviceTokenSchema,
  googleAuthSchema,
  locationSchema,
  parseInput,
  updateGroupSchema,
} from "./schemas";

interface UserRow extends QueryResultRow {
  id: string;
  display_name: string;
  profile_image_url: string | null;
  created_at: Date;
  updated_at: Date;
}

interface CountRow extends QueryResultRow {
  count: string;
}

interface GroupListRow extends QueryResultRow {
  id: string;
  name: string;
  leader_user_id: string;
  required_member_count: number;
  gathering_radius_m: number;
  gathering_duration_sec: number;
  candidate_grace_sec: number;
  leaving_duration_sec: number;
  state: string;
  member_count: string;
}

interface GroupMemberRow extends QueryResultRow {
  id: string;
  display_name: string;
  profile_image_url: string | null;
  joined_at: Date;
  is_location_sharing: boolean;
}

interface InviteRow extends QueryResultRow {
  id: string;
  group_id: string;
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
}

interface GatheringRow extends QueryResultRow {
  state: string;
  candidate_started_at: Date | null;
  gathered_at: Date | null;
  leaving_started_at: Date | null;
  recorder_user_id: string | null;
  recording_started_at: Date | null;
  updated_at: Date;
}

interface RecordingClaimRow extends QueryResultRow {
  recorder_user_id: string;
  recording_started_at: Date;
}

interface DeviceTokenRow extends QueryResultRow {
  device_token: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuidParam(params: Record<string, string>, name: string): string {
  const value = requiredParam(params, name);
  if (!UUID_PATTERN.test(value)) {
    throw new ApiError(400, "INVALID_ID", `${name} must be a UUID`);
  }
  return value;
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function userDto(row: UserRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    profileImageUrl: row.profile_image_url,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function groupDto(row: GroupListRow) {
  return {
    id: row.id,
    name: row.name,
    leaderUserId: row.leader_user_id,
    requiredMemberCount: row.required_member_count,
    gatheringRadiusM: row.gathering_radius_m,
    gatheringDurationSec: row.gathering_duration_sec,
    candidateGraceSec: row.candidate_grace_sec,
    leavingDurationSec: row.leaving_duration_sec,
    state: row.state,
    memberCount: Number(row.member_count),
  };
}

async function assertActiveUser(
  client: DatabaseClient,
  userId: string,
): Promise<void> {
  const result = await client.query("SELECT 1 FROM users WHERE id = $1", [userId]);
  if (result.rowCount !== 1) {
    throw new ApiError(401, "ACCOUNT_NOT_FOUND", "The account no longer exists");
  }
}

async function requireMembership(
  client: DatabaseClient,
  groupId: string,
  userId: string,
): Promise<void> {
  const result = await client.query(
    "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
    [groupId, userId],
  );
  if (result.rowCount !== 1) {
    throw new ApiError(404, "GROUP_NOT_FOUND", "Group was not found");
  }
}

async function requireLeader(
  client: DatabaseClient,
  groupId: string,
  userId: string,
): Promise<void> {
  const result = await client.query(
    "SELECT 1 FROM groups WHERE id = $1 AND leader_user_id = $2",
    [groupId, userId],
  );
  if (result.rowCount !== 1) {
    throw new ApiError(403, "LEADER_REQUIRED", "Only the group leader can do that");
  }
}

function secureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function handleGoogleAuth(
  request: Request,
  env: Env,
  client: DatabaseClient,
): Promise<Response> {
  const body = parseInput(googleAuthSchema, await readJson(request));
  const identity = await verifyGoogleIdToken(
    body.idToken,
    env.GOOGLE_WEB_CLIENT_ID,
  );
  const userId = crypto.randomUUID();
  const result = await client.query<UserRow>(
    `INSERT INTO users (
       id, auth_provider, provider_user_id, display_name, profile_image_url
     ) VALUES ($1, 'google', $2, $3, $4)
     ON CONFLICT (auth_provider, provider_user_id)
     DO UPDATE SET display_name = EXCLUDED.display_name,
                   profile_image_url = EXCLUDED.profile_image_url,
                   updated_at = now()
     RETURNING id, display_name, profile_image_url, created_at, updated_at`,
    [
      userId,
      identity.providerUserId,
      identity.displayName,
      identity.profileImageUrl,
    ],
  );
  const user = result.rows[0];
  if (!user) throw new ApiError(500, "USER_UPSERT_FAILED", "Could not save user");

  const sessionToken = await createSessionToken(user.id, env.AUTH_SECRET);
  return json({ sessionToken, user: userDto(user) });
}

export async function routeAuthenticated(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  client: DatabaseClient,
  userId: string,
): Promise<Response> {
  await assertActiveUser(client, userId);
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.method === "GET" && pathname === "/me") {
    const result = await client.query<UserRow>(
      `SELECT id, display_name, profile_image_url, created_at, updated_at
         FROM users
        WHERE id = $1`,
      [userId],
    );
    const user = result.rows[0];
    if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User was not found");
    return json({ user: userDto(user) });
  }

  if (request.method === "DELETE" && pathname === "/me") {
    await withTransaction(client, async () => {
      await client.query("DELETE FROM groups WHERE leader_user_id = $1", [userId]);
      await client.query("DELETE FROM users WHERE id = $1", [userId]);
    });
    return empty();
  }

  if (request.method === "GET" && pathname === "/groups") {
    const result = await client.query<GroupListRow>(
      `SELECT g.id,
              g.name,
              g.leader_user_id,
              g.required_member_count,
              g.gathering_radius_m,
              g.gathering_duration_sec,
              g.candidate_grace_sec,
              g.leaving_duration_sec,
              gs.state,
              COUNT(all_members.user_id)::text AS member_count
         FROM group_members mine
         JOIN groups g ON g.id = mine.group_id
         JOIN gathering_states gs ON gs.group_id = g.id
         JOIN group_members all_members ON all_members.group_id = g.id
        WHERE mine.user_id = $1
        GROUP BY g.id, gs.state
        ORDER BY g.created_at DESC`,
      [userId],
    );
    return json({ groups: result.rows.map(groupDto) });
  }

  if (request.method === "POST" && pathname === "/groups") {
    const body = parseInput(createGroupSchema, await readJson(request));
    const groupId = crypto.randomUUID();
    await withTransaction(client, async () => {
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
      const countResult = await client.query<CountRow>(
        "SELECT COUNT(*)::text AS count FROM group_members WHERE user_id = $1",
        [userId],
      );
      if (Number(countResult.rows[0]?.count ?? 0) >= 5) {
        throw new ApiError(409, "GROUP_LIMIT_REACHED", "You can join up to five groups");
      }

      await client.query(
        `INSERT INTO groups (id, name, leader_user_id, required_member_count)
         VALUES ($1, $2, $3, $4)`,
        [groupId, body.name, userId, body.requiredMemberCount],
      );
      await client.query(
        "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)",
        [groupId, userId],
      );
      await client.query(
        "INSERT INTO gathering_states (group_id) VALUES ($1)",
        [groupId],
      );
    });
    return json({ groupId }, { status: 201 });
  }

  const groupParams = matchPath(pathname, "/groups/:id");
  if (groupParams) {
    const groupId = uuidParam(groupParams, "id");

    if (request.method === "GET") {
      const groupResult = await client.query<GroupListRow>(
        `SELECT g.id,
                g.name,
                g.leader_user_id,
                g.required_member_count,
                g.gathering_radius_m,
                g.gathering_duration_sec,
                g.candidate_grace_sec,
                g.leaving_duration_sec,
                gs.state,
                COUNT(all_members.user_id)::text AS member_count
           FROM groups g
           JOIN group_members mine ON mine.group_id = g.id AND mine.user_id = $2
           JOIN group_members all_members ON all_members.group_id = g.id
           JOIN gathering_states gs ON gs.group_id = g.id
          WHERE g.id = $1
          GROUP BY g.id, gs.state`,
        [groupId, userId],
      );
      const group = groupResult.rows[0];
      if (!group) throw new ApiError(404, "GROUP_NOT_FOUND", "Group was not found");

      const memberResult = await client.query<GroupMemberRow>(
        `SELECT u.id,
                u.display_name,
                u.profile_image_url,
                gm.joined_at,
                (ll.user_id IS NOT NULL AND ll.captured_at >= now() - interval '5 minutes') AS is_location_sharing
           FROM group_members gm
           JOIN users u ON u.id = gm.user_id
           LEFT JOIN latest_locations ll ON ll.user_id = u.id
          WHERE gm.group_id = $1
          ORDER BY (u.id = $2) DESC, gm.joined_at`,
        [groupId, group.leader_user_id],
      );
      return json({
        group: {
          ...groupDto(group),
          members: memberResult.rows.map((member) => ({
            id: member.id,
            displayName: member.display_name,
            profileImageUrl: member.profile_image_url,
            joinedAt: member.joined_at.toISOString(),
            isLocationSharing: member.is_location_sharing,
            isLeader: member.id === group.leader_user_id,
          })),
        },
      });
    }

    if (request.method === "PATCH") {
      await requireLeader(client, groupId, userId);
      const body = parseInput(updateGroupSchema, await readJson(request));
      await client.query(
        `UPDATE groups
            SET name = COALESCE($2, name),
                required_member_count = COALESCE($3, required_member_count),
                gathering_radius_m = COALESCE($4, gathering_radius_m),
                gathering_duration_sec = COALESCE($5, gathering_duration_sec),
                candidate_grace_sec = COALESCE($6, candidate_grace_sec),
                leaving_duration_sec = COALESCE($7, leaving_duration_sec)
          WHERE id = $1`,
        [
          groupId,
          body.name ?? null,
          body.requiredMemberCount ?? null,
          body.gatheringRadiusM ?? null,
          body.gatheringDurationSec ?? null,
          body.candidateGraceSec ?? null,
          body.leavingDurationSec ?? null,
        ],
      );
      return empty();
    }

    if (request.method === "DELETE") {
      await requireLeader(client, groupId, userId);
      await client.query("DELETE FROM groups WHERE id = $1", [groupId]);
      return empty();
    }
  }

  const leaveParams = matchPath(pathname, "/groups/:id/leave");
  if (request.method === "POST" && leaveParams) {
    const groupId = uuidParam(leaveParams, "id");
    await requireMembership(client, groupId, userId);
    const leaderResult = await client.query(
      "SELECT 1 FROM groups WHERE id = $1 AND leader_user_id = $2",
      [groupId, userId],
    );
    if (leaderResult.rowCount === 1) {
      throw new ApiError(
        409,
        "LEADER_CANNOT_LEAVE",
        "The leader must delete the group in the MVP",
      );
    }
    await client.query(
      "DELETE FROM group_members WHERE group_id = $1 AND user_id = $2",
      [groupId, userId],
    );
    return empty();
  }

  const memberParams = matchPath(pathname, "/groups/:id/members/:userId");
  if (request.method === "DELETE" && memberParams) {
    const groupId = uuidParam(memberParams, "id");
    const memberUserId = uuidParam(memberParams, "userId");
    await requireLeader(client, groupId, userId);
    if (memberUserId === userId) {
      throw new ApiError(409, "CANNOT_REMOVE_LEADER", "The leader cannot remove themself");
    }
    await client.query(
      "DELETE FROM group_members WHERE group_id = $1 AND user_id = $2",
      [groupId, memberUserId],
    );
    return empty();
  }

  const inviteParams = matchPath(pathname, "/groups/:id/invites");
  if (request.method === "POST" && inviteParams) {
    const groupId = uuidParam(inviteParams, "id");
    await requireMembership(client, groupId, userId);
    const token = secureToken();
    const tokenHash = await hashToken(token);
    const inviteId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1_000);
    await client.query(
      `INSERT INTO group_invites (id, group_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [inviteId, groupId, tokenHash, expiresAt],
    );
    return json(
      {
        invite: {
          id: inviteId,
          token,
          deepLink: `monju://invite/${token}`,
          expiresAt: expiresAt.toISOString(),
        },
      },
      { status: 201 },
    );
  }

  const joinParams = matchPath(pathname, "/invites/:token/join");
  if (request.method === "POST" && joinParams) {
    const token = requiredParam(joinParams, "token");
    if (token.length < 32 || token.length > 128) {
      throw new ApiError(400, "INVALID_INVITE", "Invite token is invalid");
    }
    const tokenHash = await hashToken(token);
    const joinedGroupId = await withTransaction(client, async () => {
      const inviteResult = await client.query<InviteRow>(
        `SELECT id, group_id, expires_at, used_at, revoked_at
           FROM group_invites
          WHERE token_hash = $1
          FOR UPDATE`,
        [tokenHash],
      );
      const invite = inviteResult.rows[0];
      if (!invite || invite.revoked_at || invite.used_at || invite.expires_at <= new Date()) {
        throw new ApiError(410, "INVITE_EXPIRED", "Invite is expired or already used");
      }

      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
      const existing = await client.query(
        "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
        [invite.group_id, userId],
      );
      if (existing.rowCount === 1) {
        await client.query("UPDATE group_invites SET used_at = now() WHERE id = $1", [
          invite.id,
        ]);
        return invite.group_id;
      }

      await client.query("SELECT id FROM groups WHERE id = $1 FOR UPDATE", [
        invite.group_id,
      ]);
      const memberCountResult = await client.query<CountRow>(
        "SELECT COUNT(*)::text AS count FROM group_members WHERE group_id = $1",
        [invite.group_id],
      );
      if (Number(memberCountResult.rows[0]?.count ?? 0) >= 5) {
        throw new ApiError(409, "GROUP_FULL", "The group already has five members");
      }

      const countResult = await client.query<CountRow>(
        "SELECT COUNT(*)::text AS count FROM group_members WHERE user_id = $1",
        [userId],
      );
      if (Number(countResult.rows[0]?.count ?? 0) >= 5) {
        throw new ApiError(409, "GROUP_LIMIT_REACHED", "You can join up to five groups");
      }

      await client.query(
        "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)",
        [invite.group_id, userId],
      );
      await client.query("UPDATE group_invites SET used_at = now() WHERE id = $1", [
        invite.id,
      ]);
      return invite.group_id;
    });
    return json({ groupId: joinedGroupId });
  }

  if (request.method === "PUT" && pathname === "/me/location") {
    const body = parseInput(locationSchema, await readJson(request));
    const capturedAt = new Date(body.capturedAt);
    const now = new Date();
    if (capturedAt.getTime() > now.getTime() + 5 * 60 * 1_000) {
      throw new ApiError(400, "INVALID_CAPTURE_TIME", "Location time is too far in the future");
    }
    await client.query(
      `INSERT INTO latest_locations (
         user_id, latitude, longitude, accuracy_m, captured_at, received_at
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id)
       DO UPDATE SET latitude = EXCLUDED.latitude,
                     longitude = EXCLUDED.longitude,
                     accuracy_m = EXCLUDED.accuracy_m,
                     captured_at = EXCLUDED.captured_at,
                     received_at = EXCLUDED.received_at
       WHERE EXCLUDED.captured_at >= latest_locations.captured_at`,
      [
        userId,
        body.latitude,
        body.longitude,
        body.accuracyM,
        capturedAt,
        now,
      ],
    );

    const evaluation = await evaluateUserGroups(client, userId, now);
    for (const job of evaluation.pushJobs) {
      ctx.waitUntil(sendGatheringPush(env, job));
    }
    return json({
      suggestedPrecision: evaluation.suggestedPrecision,
      groups: evaluation.groups,
    });
  }

  if (request.method === "PUT" && pathname === "/me/device-token") {
    const body = parseInput(deviceTokenSchema, await readJson(request));
    await withTransaction(client, async () => {
      await client.query("DELETE FROM device_tokens WHERE device_token = $1", [
        body.deviceToken,
      ]);
      await client.query(
        `INSERT INTO device_tokens (user_id, device_token, platform)
         VALUES ($1, $2, $3)`,
        [userId, body.deviceToken, body.platform],
      );
    });
    return empty();
  }

  const gatheringParams = matchPath(pathname, "/groups/:id/gathering");
  if (request.method === "GET" && gatheringParams) {
    const groupId = uuidParam(gatheringParams, "id");
    await requireMembership(client, groupId, userId);
    const result = await client.query<GatheringRow>(
      `SELECT state,
              candidate_started_at,
              gathered_at,
              leaving_started_at,
              recorder_user_id,
              recording_started_at,
              updated_at
         FROM gathering_states
        WHERE group_id = $1`,
      [groupId],
    );
    const state = result.rows[0];
    if (!state) throw new ApiError(404, "GROUP_NOT_FOUND", "Group was not found");
    return json({
      gathering: {
        state: state.state,
        candidateStartedAt: iso(state.candidate_started_at),
        gatheredAt: iso(state.gathered_at),
        leavingStartedAt: iso(state.leaving_started_at),
        recorderUserId: state.recorder_user_id,
        recordingStartedAt: iso(state.recording_started_at),
        updatedAt: state.updated_at.toISOString(),
      },
    });
  }

  const recordingParams = matchPath(pathname, "/groups/:id/recording/claim");
  if (request.method === "POST" && recordingParams) {
    const groupId = uuidParam(recordingParams, "id");
    await requireMembership(client, groupId, userId);
    const tokenResult = await client.query<DeviceTokenRow>(
      `SELECT DISTINCT dt.device_token
         FROM group_members gm
         JOIN device_tokens dt ON dt.user_id = gm.user_id
        WHERE gm.group_id = $1`,
      [groupId],
    );
    const result = await client.query<RecordingClaimRow>(
      `UPDATE gathering_states
          SET recorder_user_id = $1,
              recording_started_at = now(),
              updated_at = now()
        WHERE group_id = $2
          AND state = 'GATHERED'
          AND recorder_user_id IS NULL
      RETURNING recorder_user_id, recording_started_at`,
      [userId, groupId],
    );
    const claim = result.rows[0];
    if (!claim) {
      const stateResult = await client.query<GatheringRow>(
        `SELECT state, candidate_started_at, gathered_at, leaving_started_at,
                recorder_user_id, recording_started_at, updated_at
           FROM gathering_states
          WHERE group_id = $1`,
        [groupId],
      );
      const state = stateResult.rows[0];
      if (state?.state !== "GATHERED") {
        throw new ApiError(409, "NOT_GATHERED", "The group is not gathered");
      }
      throw new ApiError(
        409,
        "RECORDER_ALREADY_CLAIMED",
        "Another member already started recording",
      );
    }
    ctx.waitUntil(
      sendRecordingStartedPush(env, {
        groupId,
        deviceTokens: tokenResult.rows.map((row) => row.device_token),
      }),
    );
    return json({
      recorderUserId: claim.recorder_user_id,
      recordingStartedAt: claim.recording_started_at.toISOString(),
    });
  }

  throw new ApiError(404, "NOT_FOUND", "Route was not found");
}
