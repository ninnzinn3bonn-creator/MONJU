import { z } from "zod";

import { ApiError } from "./errors";

export function parseInput<T extends z.ZodType>(
  schema: T,
  input: unknown,
): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "The request data is invalid",
      result.error.issues,
    );
  }
  return result.data;
}

export const googleAuthSchema = z.object({
  idToken: z.string().min(100).max(10_000),
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  requiredMemberCount: z.number().int().min(2).max(5).default(2),
});

export const updateGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    requiredMemberCount: z.number().int().min(2).max(5).optional(),
    gatheringRadiusM: z.number().int().min(10).max(500).optional(),
    gatheringDurationSec: z.number().int().min(10).max(3_600).optional(),
    candidateGraceSec: z.number().int().min(0).max(60).optional(),
    leavingDurationSec: z.number().int().min(60).max(86_400).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one setting is required",
  });

export const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().nonnegative().max(100_000),
  capturedAt: z.string().datetime({ offset: true }),
});

export const deviceTokenSchema = z.object({
  deviceToken: z.string().min(10).max(1_024),
  platform: z.enum(["ios", "android"]),
});
