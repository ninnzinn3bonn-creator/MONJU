import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../src/db";
import { routeAuthenticated } from "../src/routes";

const groupId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function context(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext;
}

describe("recording claim", () => {
  it("atomically claims a gathered group for the first member", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ recorder_user_id: userId, recording_started_at: new Date(0) }],
      });

    const response = await routeAuthenticated(
      new Request(`https://monju.test/groups/${groupId}/recording/claim`, {
        method: "POST",
      }),
      { EXPO_PUSH_ENDPOINT: "https://exp.host/push" } as unknown as Env,
      context(),
      { query } as unknown as DatabaseClient,
      userId,
    );

    expect(response.status).toBe(200);
    expect(query.mock.calls[3]?.[0]).toContain("state = 'GATHERED'");
    expect(query.mock.calls[3]?.[0]).toContain("recorder_user_id IS NULL");
  });

  it("rejects a second member after the recorder is claimed", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            state: "GATHERED",
            recorder_user_id: "33333333-3333-4333-8333-333333333333",
          },
        ],
      });

    await expect(
      routeAuthenticated(
        new Request(`https://monju.test/groups/${groupId}/recording/claim`, {
          method: "POST",
        }),
        { EXPO_PUSH_ENDPOINT: "https://exp.host/push" } as unknown as Env,
        context(),
        { query } as unknown as DatabaseClient,
        userId,
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "RECORDER_ALREADY_CLAIMED",
    });
  });
});
