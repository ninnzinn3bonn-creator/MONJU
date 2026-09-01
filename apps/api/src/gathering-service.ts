import {
  evaluateGatheringCondition,
  shouldSendGatheringNotification,
  transitionGatheringState,
  type GatheringPolicy,
  type GatheringSnapshot,
  type GatheringStateName,
  type LocationPoint,
  type PrecisionMode,
} from "@monju/domain";
import type { QueryResultRow } from "pg";

import type { DatabaseClient } from "./db";
import { withTransaction } from "./db";
import type { GatheringPushJob } from "./push";

interface UserGroupRow extends QueryResultRow {
  group_id: string;
}

interface GroupEvaluationRow extends QueryResultRow {
  id: string;
  required_member_count: number;
  gathering_radius_m: number;
  gathering_duration_sec: number;
  candidate_grace_sec: number;
  leaving_duration_sec: number;
  state: GatheringStateName;
  candidate_started_at: Date | null;
  condition_lost_at: Date | null;
  gathered_at: Date | null;
  leaving_started_at: Date | null;
  last_notification_at: Date | null;
  recorder_user_id: string | null;
}

interface LocationRow extends QueryResultRow {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number;
  captured_at: Date;
}

interface DeviceTokenRow extends QueryResultRow {
  device_token: string;
}

export interface EvaluatedGroupState {
  groupId: string;
  state: GatheringStateName;
  qualifyingMemberCount: number;
}

export interface LocationEvaluationResult {
  suggestedPrecision: PrecisionMode;
  groups: EvaluatedGroupState[];
  pushJobs: GatheringPushJob[];
}

const PRECISION_RANK: Record<PrecisionMode, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

function maxPrecision(a: PrecisionMode, b: PrecisionMode): PrecisionMode {
  return PRECISION_RANK[a] >= PRECISION_RANK[b] ? a : b;
}

function toPolicy(row: GroupEvaluationRow): GatheringPolicy {
  return {
    requiredMemberCount: row.required_member_count,
    radiusM: row.gathering_radius_m,
    gatheringDurationSec: row.gathering_duration_sec,
    candidateGraceSec: row.candidate_grace_sec,
    leavingDurationSec: row.leaving_duration_sec,
    staleAfterSec: 300,
  };
}

function toSnapshot(row: GroupEvaluationRow): GatheringSnapshot {
  return {
    state: row.state,
    candidateStartedAt: row.candidate_started_at,
    conditionLostAt: row.condition_lost_at,
    gatheredAt: row.gathered_at,
    leavingStartedAt: row.leaving_started_at,
  };
}

function toLocation(row: LocationRow): LocationPoint {
  return {
    userId: row.user_id,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyM: row.accuracy_m,
    capturedAt: row.captured_at,
  };
}

export async function evaluateUserGroups(
  client: DatabaseClient,
  userId: string,
  now: Date,
): Promise<LocationEvaluationResult> {
  const memberships = await client.query<UserGroupRow>(
    `SELECT group_id
       FROM group_members
      WHERE user_id = $1
      ORDER BY joined_at`,
    [userId],
  );

  let suggestedPrecision: PrecisionMode = "LOW";
  const groups: EvaluatedGroupState[] = [];
  const pushJobs: GatheringPushJob[] = [];

  for (const membership of memberships.rows) {
    const result = await withTransaction(client, async () => {
      const stateResult = await client.query<GroupEvaluationRow>(
        `SELECT g.id,
                g.required_member_count,
                g.gathering_radius_m,
                g.gathering_duration_sec,
                g.candidate_grace_sec,
                g.leaving_duration_sec,
                gs.state,
                gs.candidate_started_at,
                gs.condition_lost_at,
                gs.gathered_at,
                gs.leaving_started_at,
                gs.last_notification_at,
                gs.recorder_user_id
           FROM groups g
           JOIN gathering_states gs ON gs.group_id = g.id
          WHERE g.id = $1
          FOR UPDATE OF gs`,
        [membership.group_id],
      );
      const stateRow = stateResult.rows[0];
      if (!stateRow) return null;

      const locationResult = await client.query<LocationRow>(
        `SELECT ll.user_id,
                ll.latitude,
                ll.longitude,
                ll.accuracy_m,
                ll.captured_at
           FROM group_members gm
           JOIN latest_locations ll ON ll.user_id = gm.user_id
          WHERE gm.group_id = $1`,
        [stateRow.id],
      );

      const policy = toPolicy(stateRow);
      const condition = evaluateGatheringCondition(
        locationResult.rows.map(toLocation),
        policy,
        now,
      );
      const transition = transitionGatheringState({
        snapshot: toSnapshot(stateRow),
        conditionMet: condition.met,
        now,
        gatheringDurationSec: policy.gatheringDurationSec,
        candidateGraceSec: policy.candidateGraceSec,
        leavingDurationSec: policy.leavingDurationSec,
      });
      const shouldNotify =
        transition.becameGathered ||
        shouldSendGatheringNotification({
          state: transition.snapshot.state,
          lastNotificationAt: stateRow.last_notification_at,
          recorderUserId: stateRow.recorder_user_id,
          now,
        });

      await client.query(
        `UPDATE gathering_states
            SET state = $1,
                candidate_started_at = $2,
                condition_lost_at = $3,
                gathered_at = $4,
                leaving_started_at = $5,
                updated_at = $6,
                last_notification_at = CASE
                  WHEN $10::boolean THEN NULL
                  WHEN $8::boolean THEN $9
                  ELSE last_notification_at
                END,
                recorder_user_id = CASE WHEN $10::boolean THEN NULL ELSE recorder_user_id END,
                recording_started_at = CASE WHEN $10::boolean THEN NULL ELSE recording_started_at END
          WHERE group_id = $7`,
        [
          transition.snapshot.state,
          transition.snapshot.candidateStartedAt,
          transition.snapshot.conditionLostAt,
          transition.snapshot.gatheredAt,
          transition.snapshot.leavingStartedAt,
          now,
          stateRow.id,
          shouldNotify,
          now,
          transition.becameNotGathered,
        ],
      );

      let pushJob: GatheringPushJob | null = null;
      if (shouldNotify) {
        const tokenResult = await client.query<DeviceTokenRow>(
          `SELECT DISTINCT dt.device_token
             FROM group_members gm
             JOIN device_tokens dt ON dt.user_id = gm.user_id
            WHERE gm.group_id = $1`,
          [stateRow.id],
        );
        pushJob = {
          groupId: stateRow.id,
          gatheredMemberCount: condition.qualifyingUserIds.length,
          deviceTokens: tokenResult.rows.map((row) => row.device_token),
        };
      }

      return {
        state: {
          groupId: stateRow.id,
          state: transition.snapshot.state,
          qualifyingMemberCount: condition.qualifyingUserIds.length,
        } satisfies EvaluatedGroupState,
        suggestedPrecision: condition.suggestedPrecision,
        pushJob,
      };
    });

    if (!result) continue;
    groups.push(result.state);
    suggestedPrecision = maxPrecision(
      suggestedPrecision,
      result.suggestedPrecision,
    );
    if (result.pushJob && result.pushJob.deviceTokens.length > 0) {
      pushJobs.push(result.pushJob);
    }
  }

  return { suggestedPrecision, groups, pushJobs };
}
