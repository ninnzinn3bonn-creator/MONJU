export const GATHERING_STATES = [
  "NOT_GATHERED",
  "CANDIDATE",
  "GATHERED",
  "LEAVING",
] as const;

export type GatheringStateName = (typeof GATHERING_STATES)[number];

export type PrecisionMode = "LOW" | "MEDIUM" | "HIGH";

export interface LocationPoint {
  userId: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  capturedAt: Date;
}

export interface GatheringPolicy {
  requiredMemberCount: number;
  radiusM: number;
  gatheringDurationSec: number;
  candidateGraceSec: number;
  leavingDurationSec: number;
  staleAfterSec: number;
}

export interface GatheringSnapshot {
  state: GatheringStateName;
  candidateStartedAt: Date | null;
  conditionLostAt: Date | null;
  gatheredAt: Date | null;
  leavingStartedAt: Date | null;
}

export interface GatheringCondition {
  met: boolean;
  qualifyingUserIds: string[];
  validLocationCount: number;
  staleUserIds: string[];
  inaccurateUserIds: string[];
  suggestedPrecision: PrecisionMode;
}

export interface GatheringTransition {
  snapshot: GatheringSnapshot;
  becameGathered: boolean;
  becameNotGathered: boolean;
}

export const DEFAULT_GATHERING_POLICY: GatheringPolicy = {
  requiredMemberCount: 2,
  radiusM: 50,
  gatheringDurationSec: 60,
  candidateGraceSec: 5,
  leavingDurationSec: 600,
  staleAfterSec: 300,
};

export const EMPTY_GATHERING_SNAPSHOT: GatheringSnapshot = {
  state: "NOT_GATHERED",
  candidateStartedAt: null,
  conditionLostAt: null,
  gatheredAt: null,
  leavingStartedAt: null,
};
