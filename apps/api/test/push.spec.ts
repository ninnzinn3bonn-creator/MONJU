import { describe, expect, it } from "vitest";

import {
  createGatheringPushMessages,
  createRecordingStartedPushMessages,
} from "../src/push";

describe("push messages", () => {
  it("offers the recording action when a gathering is detected", () => {
    expect(
      createGatheringPushMessages({
        groupId: "group-1",
        gatheredMemberCount: 3,
        deviceTokens: ["token-1"],
      }),
    ).toEqual([
      expect.objectContaining({
        to: "token-1",
        categoryId: "gathering",
        data: { action: "START_RECORDING", groupId: "group-1" },
      }),
    ]);
  });

  it("opens the group without another recording action after recording starts", () => {
    expect(
      createRecordingStartedPushMessages({
        groupId: "group-1",
        deviceTokens: ["token-1", "token-2"],
      }),
    ).toEqual([
      expect.objectContaining({
        to: "token-1",
        data: { action: "OPEN_GROUP", groupId: "group-1" },
      }),
      expect.objectContaining({
        to: "token-2",
        data: { action: "OPEN_GROUP", groupId: "group-1" },
      }),
    ]);
  });
});
