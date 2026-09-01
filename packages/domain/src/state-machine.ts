import type {
  GatheringSnapshot,
  GatheringTransition,
} from "./types";

export interface TransitionInput {
  snapshot: GatheringSnapshot;
  conditionMet: boolean;
  now: Date;
  gatheringDurationSec: number;
  candidateGraceSec: number;
  leavingDurationSec: number;
}

export interface GatheringNotificationInput {
  state: GatheringSnapshot["state"];
  lastNotificationAt: Date | null;
  recorderUserId: string | null;
  now: Date;
  repeatAfterSec?: number;
}

function elapsedSec(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 1_000;
}

export function shouldSendGatheringNotification({
  state,
  lastNotificationAt,
  recorderUserId,
  now,
  repeatAfterSec = 1_800,
}: GatheringNotificationInput): boolean {
  if (state !== "GATHERED" || recorderUserId) return false;
  if (!lastNotificationAt) return true;
  return elapsedSec(lastNotificationAt, now) >= repeatAfterSec;
}

export function transitionGatheringState({
  snapshot,
  conditionMet,
  now,
  gatheringDurationSec,
  candidateGraceSec,
  leavingDurationSec,
}: TransitionInput): GatheringTransition {
  const next: GatheringSnapshot = { ...snapshot };
  let becameGathered = false;
  let becameNotGathered = false;

  switch (snapshot.state) {
    case "NOT_GATHERED": {
      if (conditionMet) {
        next.state = "CANDIDATE";
        next.candidateStartedAt = now;
        next.conditionLostAt = null;
      }
      break;
    }

    case "CANDIDATE": {
      const startedAt = snapshot.candidateStartedAt ?? now;
      next.candidateStartedAt = startedAt;

      if (conditionMet) {
        next.conditionLostAt = null;
        if (elapsedSec(startedAt, now) >= gatheringDurationSec) {
          next.state = "GATHERED";
          next.gatheredAt = now;
          next.leavingStartedAt = null;
          becameGathered = true;
        }
      } else if (!snapshot.conditionLostAt) {
        next.conditionLostAt = now;
      } else if (elapsedSec(snapshot.conditionLostAt, now) > candidateGraceSec) {
        next.state = "NOT_GATHERED";
        next.candidateStartedAt = null;
        next.conditionLostAt = null;
      }
      break;
    }

    case "GATHERED": {
      if (!conditionMet) {
        next.state = "LEAVING";
        next.leavingStartedAt = now;
      }
      break;
    }

    case "LEAVING": {
      if (conditionMet) {
        next.state = "GATHERED";
        next.leavingStartedAt = null;
      } else {
        const leavingStartedAt = snapshot.leavingStartedAt ?? now;
        next.leavingStartedAt = leavingStartedAt;
        if (elapsedSec(leavingStartedAt, now) >= leavingDurationSec) {
          next.state = "NOT_GATHERED";
          next.candidateStartedAt = null;
          next.conditionLostAt = null;
          next.gatheredAt = null;
          next.leavingStartedAt = null;
          becameNotGathered = true;
        }
      }
      break;
    }
  }

  return { snapshot: next, becameGathered, becameNotGathered };
}
