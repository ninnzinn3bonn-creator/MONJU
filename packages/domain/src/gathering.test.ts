import { describe, expect, it } from "vitest";

import { evaluateGatheringCondition } from "./gathering";
import {
  shouldSendGatheringNotification,
  transitionGatheringState,
} from "./state-machine";
import {
  DEFAULT_GATHERING_POLICY,
  EMPTY_GATHERING_SNAPSHOT,
  type LocationPoint,
} from "./types";

const NOW = new Date("2026-08-27T10:00:00.000Z");

function point(
  userId: string,
  northM: number,
  accuracyM = 5,
  capturedAt = NOW,
): LocationPoint {
  return {
    userId,
    latitude: 35 + northM / 111_320,
    longitude: 139,
    accuracyM,
    capturedAt,
  };
}

describe("evaluateGatheringCondition", () => {
  it("accepts three users within 50m of their centroid", () => {
    const result = evaluateGatheringCondition(
      [point("a", -20), point("b", 0), point("c", 20)],
      { ...DEFAULT_GATHERING_POLICY, requiredMemberCount: 3 },
      NOW,
    );

    expect(result.met).toBe(true);
    expect(result.qualifyingUserIds).toHaveLength(3);
  });

  it("rejects stale locations older than five minutes", () => {
    const stale = new Date(NOW.getTime() - 301_000);
    const result = evaluateGatheringCondition(
      [point("a", 0), point("b", 2, 5, stale)],
      DEFAULT_GATHERING_POLICY,
      NOW,
    );

    expect(result.met).toBe(false);
    expect(result.staleUserIds).toEqual(["b"]);
  });

  it("holds the decision when GPS accuracy is worse than the radius", () => {
    const result = evaluateGatheringCondition(
      [point("a", 0), point("b", 2, 80)],
      DEFAULT_GATHERING_POLICY,
      NOW,
    );

    expect(result.met).toBe(false);
    expect(result.inaccurateUserIds).toEqual(["b"]);
    expect(result.suggestedPrecision).toBe("HIGH");
  });
});

describe("transitionGatheringState", () => {
  it("becomes gathered after one continuous minute", () => {
    const candidate = transitionGatheringState({
      snapshot: EMPTY_GATHERING_SNAPSHOT,
      conditionMet: true,
      now: NOW,
      gatheringDurationSec: 60,
      candidateGraceSec: 5,
      leavingDurationSec: 600,
    });

    const gathered = transitionGatheringState({
      snapshot: candidate.snapshot,
      conditionMet: true,
      now: new Date(NOW.getTime() + 60_000),
      gatheringDurationSec: 60,
      candidateGraceSec: 5,
      leavingDurationSec: 600,
    });

    expect(gathered.snapshot.state).toBe("GATHERED");
    expect(gathered.becameGathered).toBe(true);
  });

  it("does not reset a candidate during the five-second grace period", () => {
    const candidate = {
      ...EMPTY_GATHERING_SNAPSHOT,
      state: "CANDIDATE" as const,
      candidateStartedAt: NOW,
    };
    const lost = transitionGatheringState({
      snapshot: candidate,
      conditionMet: false,
      now: new Date(NOW.getTime() + 30_000),
      gatheringDurationSec: 60,
      candidateGraceSec: 5,
      leavingDurationSec: 600,
    });
    const recovered = transitionGatheringState({
      snapshot: lost.snapshot,
      conditionMet: true,
      now: new Date(NOW.getTime() + 34_000),
      gatheringDurationSec: 60,
      candidateGraceSec: 5,
      leavingDurationSec: 600,
    });

    expect(recovered.snapshot.state).toBe("CANDIDATE");
    expect(recovered.snapshot.candidateStartedAt).toEqual(NOW);
    expect(recovered.snapshot.conditionLostAt).toBeNull();
  });

  it("dissolves only after ten minutes outside the condition", () => {
    const gathered = {
      ...EMPTY_GATHERING_SNAPSHOT,
      state: "GATHERED" as const,
      gatheredAt: NOW,
    };
    const leaving = transitionGatheringState({
      snapshot: gathered,
      conditionMet: false,
      now: new Date(NOW.getTime() + 1_000),
      gatheringDurationSec: 60,
      candidateGraceSec: 5,
      leavingDurationSec: 600,
    });
    const dissolved = transitionGatheringState({
      snapshot: leaving.snapshot,
      conditionMet: false,
      now: new Date(NOW.getTime() + 601_000),
      gatheringDurationSec: 60,
      candidateGraceSec: 5,
      leavingDurationSec: 600,
    });

    expect(dissolved.snapshot.state).toBe("NOT_GATHERED");
    expect(dissolved.becameNotGathered).toBe(true);
  });

  it("can gather again after the group has dissolved", () => {
    const dissolved = {
      ...EMPTY_GATHERING_SNAPSHOT,
      state: "NOT_GATHERED" as const,
    };
    const candidate = transitionGatheringState({
      snapshot: dissolved,
      conditionMet: true,
      now: NOW,
      gatheringDurationSec: 60,
      candidateGraceSec: 5,
      leavingDurationSec: 600,
    });
    const gathered = transitionGatheringState({
      snapshot: candidate.snapshot,
      conditionMet: true,
      now: new Date(NOW.getTime() + 60_000),
      gatheringDurationSec: 60,
      candidateGraceSec: 5,
      leavingDurationSec: 600,
    });

    expect(gathered.snapshot.state).toBe("GATHERED");
    expect(gathered.becameGathered).toBe(true);
  });
});

describe("shouldSendGatheringNotification", () => {
  it("repeats after 30 minutes only while gathered without a recorder", () => {
    expect(
      shouldSendGatheringNotification({
        state: "GATHERED",
        lastNotificationAt: new Date(NOW.getTime() - 1_800_000),
        recorderUserId: null,
        now: NOW,
      }),
    ).toBe(true);
    expect(
      shouldSendGatheringNotification({
        state: "GATHERED",
        lastNotificationAt: new Date(NOW.getTime() - 1_799_000),
        recorderUserId: null,
        now: NOW,
      }),
    ).toBe(false);
    expect(
      shouldSendGatheringNotification({
        state: "GATHERED",
        lastNotificationAt: new Date(NOW.getTime() - 3_600_000),
        recorderUserId: "recorder",
        now: NOW,
      }),
    ).toBe(false);
  });
});
