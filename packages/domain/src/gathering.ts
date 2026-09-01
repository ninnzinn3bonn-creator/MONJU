import { geographicCentroid, haversineDistanceM } from "./geo";
import type {
  GatheringCondition,
  GatheringPolicy,
  LocationPoint,
} from "./types";

function uniqueByUser(points: readonly LocationPoint[]): LocationPoint[] {
  const latest = new Map<string, LocationPoint>();

  for (const point of points) {
    const current = latest.get(point.userId);
    if (!current || current.capturedAt < point.capturedAt) {
      latest.set(point.userId, point);
    }
  }

  return [...latest.values()];
}

function findLargestCentroidCohort(
  points: readonly LocationPoint[],
  radiusM: number,
): LocationPoint[] {
  let best: LocationPoint[] = [];

  for (const anchor of points) {
    let cohort = points.filter(
      (point) => haversineDistanceM(anchor, point) <= radiusM * 2,
    );

    for (let iteration = 0; iteration < 3 && cohort.length > 0; iteration += 1) {
      const centroid = geographicCentroid(cohort);
      const next = points.filter(
        (point) => haversineDistanceM(centroid, point) <= radiusM,
      );

      if (
        next.length === cohort.length &&
        next.every((point) => cohort.some((item) => item.userId === point.userId))
      ) {
        cohort = next;
        break;
      }

      cohort = next;
    }

    if (cohort.length > best.length) {
      best = cohort;
    }
  }

  return best;
}

export function evaluateGatheringCondition(
  locations: readonly LocationPoint[],
  policy: GatheringPolicy,
  now: Date,
): GatheringCondition {
  const deduplicated = uniqueByUser(locations);
  const staleBoundary = now.getTime() - policy.staleAfterSec * 1_000;
  const staleUserIds = deduplicated
    .filter((point) => point.capturedAt.getTime() < staleBoundary)
    .map((point) => point.userId);
  const fresh = deduplicated.filter(
    (point) => point.capturedAt.getTime() >= staleBoundary,
  );

  // An uncertainty circle wider than the gathering radius cannot prove that a
  // user is inside the radius, so the server stays conservative.
  const inaccurateUserIds = fresh
    .filter((point) => point.accuracyM > policy.radiusM)
    .map((point) => point.userId);
  const trustworthy = fresh.filter(
    (point) => point.accuracyM <= policy.radiusM,
  );
  const cohort = findLargestCentroidCohort(trustworthy, policy.radiusM);

  let suggestedPrecision: GatheringCondition["suggestedPrecision"] = "LOW";
  if (inaccurateUserIds.length > 0 || cohort.length >= policy.requiredMemberCount - 1) {
    suggestedPrecision = "HIGH";
  } else if (trustworthy.length > 1) {
    suggestedPrecision = "MEDIUM";
  }

  return {
    met: cohort.length >= policy.requiredMemberCount,
    qualifyingUserIds: cohort.map((point) => point.userId),
    validLocationCount: trustworthy.length,
    staleUserIds,
    inaccurateUserIds,
    suggestedPrecision,
  };
}
